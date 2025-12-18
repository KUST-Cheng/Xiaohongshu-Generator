
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

/**
 * 每次调用动态创建实例，确保使用最新的 process.env.API_KEY
 */
const getAi = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined" || apiKey.trim() === "") {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

export const generatePostText = async (
  topic: string,
  style: string,
  length: string,
  isTemplateMode: boolean
): Promise<GeneratedPost> => {
  try {
    const ai = getAi();
    
    // 针对长文案采用更强大的 Pro 模型以保证逻辑深度
    const isLongPost = length === 'long';
    const modelName = isLongPost ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    
    // 动态构建更精细的 Prompt
    const lengthRequirement = isLongPost 
      ? "这是一篇长笔记（800字以上）。请提供深度的见解，使用4-5个带Emoji的副标题划分段落，每段内容要详实。包含强力的钩子开头和走心的结尾总结。" 
      : (length === 'short' ? "短精悍，200字内，直击痛点。" : "标准长度，400字左右，排版清晰。");

    const prompt = `
      你是一位拥有百万粉丝的小红书爆款博主。
      请根据以下信息创作一篇极具吸引力的笔记：
      - 主题: ${topic}
      - 风格: ${style}
      - 篇幅: ${length} (${lengthRequirement})

      要求：
      1. 标题：充满悬念或情绪，控制在20字内。
      2. 正文：必须使用大量的 Emoji，逻辑分明，段落之间有明显的呼吸感。
      3. 互动：结尾要设计一个引导互动的提问。
      4. 标签：生成5-8个高流量标签。
      ${isTemplateMode ? '5. 提取封面关键信息：main_title (主标题), highlight_text (高亮金句), body_preview (简短摘要)。' : ''}
    `;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        // 为 Pro 模型的长文生成分配思考预算，提高连贯性
        ...(isLongPost ? { thinkingConfig: { thinkingBudget: 4000 } } : {}),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            cover_summary: {
              type: Type.OBJECT,
              properties: {
                main_title: { type: Type.STRING },
                highlight_text: { type: Type.STRING },
                body_preview: { type: Type.STRING }
              },
              nullable: true
            }
          },
          required: ["title", "content", "tags"]
        }
      },
    });

    const resultText = response.text;
    if (!resultText) throw new Error("API_RESPONSE_EMPTY");
    return JSON.parse(resultText);
  } catch (error: any) {
    console.error("Text Gen Error:", error);
    const msg = error.message || "";
    // 识别权限或授权错误
    if (msg.includes("403") || msg.includes("401") || msg.includes("Requested entity was not found")) {
      throw new Error("AUTH_FAILED");
    }
    if (msg.includes("429")) throw new Error("QUOTA_EXCEEDED");
    throw error;
  }
};

export const generatePostImage = async (
  topic: string,
  style: string,
  refImageBase64?: string
): Promise<string> => {
  try {
    const ai = getAi();
    const model = "gemini-2.5-flash-image";
    
    const styleKeywords: Record<string, string> = {
      emotional: "soft natural lighting, cinematic photography, high-end healing vibe",
      educational: "clean minimalist desk setup, soft pastel tones, organized layout",
      promotion: "luxurious aesthetic product display, magazine-style lighting",
      rant: "authentic street style, high contrast, dramatic shadows"
    };

    const promptText = `High quality aesthetic Xiaohongshu cover image for topic: "${topic}". Style: ${styleKeywords[style] || "aesthetic"}. 3:4 aspect ratio, professional camera quality, no visible text or watermarks.`;

    const parts: any[] = [];
    if (refImageBase64) {
      parts.push({ inlineData: { mimeType: 'image/png', data: refImageBase64 } });
      parts.push({ text: `Based on this composition, generate a new aesthetic cover for "${topic}". Keep the vibe but create a new scene.` });
    } else {
      parts.push({ text: promptText });
    }

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: { imageConfig: { aspectRatio: "3:4" } }
    });

    const imageData = response.candidates?.[0]?.content?.parts.find(p => p.inlineData)?.inlineData;
    if (imageData) {
      return `data:${imageData.mimeType};base64,${imageData.data}`;
    }
    throw new Error("IMAGE_DATA_NOT_FOUND");
  } catch (error: any) {
    // 降级处理：生图失败时不阻塞整体流程，返回 Pollinations 备用引擎
    console.warn("Image generation failed, using fallback engine.", error);
    const seed = Math.floor(Math.random() * 100000);
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(topic + ", aesthetic style, cinematic") }?width=1080&height=1440&seed=${seed}&nologo=true`;
  }
};

export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `针对话题“${topic}”，给出5个小红书爆款切入点。JSON数组格式。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (e) {
    return [];
  }
};
