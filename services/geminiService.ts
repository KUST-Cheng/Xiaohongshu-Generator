import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

/**
 * 获取 AI 实例
 * 严格遵守安全规范：仅从环境变量获取，不进行任何本地硬编码
 * 每次调用即时创建，确保获取最新的 process.env.API_KEY
 */
const getAiClient = () => {
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
    const ai = getAiClient();
    
    // 针对长文案（Long）使用 Pro 模型以获得更好的连贯性和深度
    const isLong = length === 'long';
    const model = isLong ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    
    // 优化长文案 Prompt
    const lengthDetail = isLong 
      ? "这是一篇长笔记（约800-1000字）。请确保结构严谨：1. 强吸引力钩子开头；2. 使用3-4个带Emoji的副标题划分核心段落，内容要详实、有深度；3. 总结金句 + 互动提问结尾。" 
      : (length === 'short' ? "短小精悍，200字内，直击痛点。" : "标准小红书篇幅，400字左右，结构清晰。");

    const prompt = `
      你是一位拥有百万粉丝的小红书顶级爆款博主，擅长创作高点击、高转化、高互动的笔记。
      请根据以下信息创作：
      - 主题: ${topic}
      - 风格: ${style}
      - 长度: ${length}
      - 具体要求: ${lengthDetail}

      创作准则：
      1. 标题：充满情绪价值、悬念或痛点，控制在20字内。
      2. 排版：段落短小，大量使用 Emoji 增加呼吸感。
      3. 标签：末尾提供 5-8 个精准的高流量标签。
      ${isTemplateMode ? '4. 提取封面关键信息：main_title (10字内主标题), highlight_text (金句), body_preview (30字正文摘要)。' : ''}
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        // 为长文案分配思考预算，确保逻辑不崩溃
        ...(isLong ? { thinkingConfig: { thinkingBudget: 4000 } } : {}),
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

    const text = response.text;
    if (!text) throw new Error("API_EMPTY_RESPONSE");
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Text Generation Error:", error);
    const msg = error.message || "";
    // 捕捉 Key 泄露、无效或配额错误
    if (msg.includes("leaked") || msg.includes("403") || msg.includes("401") || msg.includes("not found")) {
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
    const ai = getAiClient();
    const model = 'gemini-2.5-flash-image';
    
    const styleKeywords: Record<string, string> = {
      emotional: "soft light, cinematic, emotional photography, healing vibe",
      educational: "minimalist, clean workspace, high quality design, flat lay",
      promotion: "commercial photography, high contrast, vibrant, luxury",
      rant: "street style, authentic, gritty, impactful"
    };

    const promptText = `Aesthetic Xiaohongshu cover image for: "${topic}". Style: ${styleKeywords[style] || "aesthetic"}. 3:4 aspect ratio, high resolution, professional photography, no text.`;

    const parts: any[] = [];
    if (refImageBase64) {
      parts.push({ inlineData: { mimeType: 'image/png', data: refImageBase64 } });
      parts.push({ text: `Generate a new cover based on this reference image's composition for topic "${topic}".` });
    } else {
      parts.push({ text: promptText });
    }

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: { imageConfig: { aspectRatio: "3:4" } }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("IMAGE_DATA_MISSING");
  } catch (error: any) {
    console.warn("Image gen failed, using fallback:", error);
    // 降级使用备用生图，防止阻塞
    const seed = Math.floor(Math.random() * 99999);
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(topic + ", aesthetic, 4k, cinematic")}?width=1080&height=1440&seed=${seed}&nologo=true`;
  }
};

export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `针对话题“${topic}”，提供5个小红书爆款切入点，JSON数组格式。`,
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