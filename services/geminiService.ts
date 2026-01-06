
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

/**
 * 核心逻辑：直接使用注入的 process.env.API_KEY
 * 按照规范，在每次调用前即时实例化 GoogleGenAI，确保获取最新的授权状态。
 */
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("AUTH_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * 处理 API 错误并返回可读性强的错误标识
 */
const handleApiError = (error: any) => {
  const msg = error?.message || "";
  console.error("Gemini API Error:", error);

  if (msg.includes("429") || msg.includes("quota")) return "QUOTA_EXCEEDED";
  if (msg.includes("401") || msg.includes("invalid")) return "AUTH_INVALID";
  if (msg.includes("403")) return "PERMISSION_DENIED";
  if (msg.includes("entity was not found")) return "AUTH_NEED_RESET";
  
  return msg || "UNKNOWN_ERROR";
};

export const generatePostText = async (
  topic: string,
  style: string,
  length: string,
  isTemplateMode: boolean
): Promise<GeneratedPost> => {
  const ai = getAiClient();
  
  const lengthStrategy = length === 'long' 
    ? "这是一篇深度长文（约800字），需要清晰的逻辑结构、丰富的细节和多级副标题。" 
    : (length === 'short' ? "短小精悍，控制在200字以内，重点突出。" : "中等篇幅，400字左右，排版舒适。");

  const prompt = `
    你是一位拥有千万粉丝的小红书爆款博主，擅长捕捉热点、制造共鸣、编写高点击率标题。
    针对话题“${topic}”，创作一篇风格为“${style}”的爆款笔记。
    
    【篇幅策略】
    ${lengthStrategy}
    
    【创作指南】
    1. 标题：必须包含 2-3 个关键词，使用至少 3 个表情符号。
    2. 正文：使用“呼吸感”排版，多用 Emoji，段落短小，语感亲切。
    3. 标签：生成 5-10 个热点搜索标签。
    ${isTemplateMode ? '4. 封面文案：提取 main_title (主标题), highlight_text (金句), body_preview (摘要预览)。' : ''}
    
    必须严格输出纯 JSON 格式。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 }, // 旗舰模型启用深度思考
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
    if (!text) throw new Error("AI_EMPTY_RESPONSE");
    return JSON.parse(text);
  } catch (error: any) {
    throw new Error(handleApiError(error));
  }
};

export const generatePostImage = async (
  topic: string,
  style: string,
  refImageBase64?: string
): Promise<string> => {
  const ai = getAiClient();
  
  const styleKeywords: Record<string, string> = {
    emotional: "healing, cinematic lifestyle, soft film grain, moody lighting",
    educational: "minimalist flatlay, aesthetic desk setup, bright workspace",
    promotion: "luxury product photography, professional studio lighting, 4k",
    rant: "authentic street style, dramatic high contrast, realistic atmosphere"
  };

  const parts: any[] = [];
  if (refImageBase64) {
    parts.push({
      inlineData: { mimeType: 'image/png', data: refImageBase64 }
    });
    parts.push({ text: `基于参考图的构图和氛围，为话题“${topic}”生成一张高审美的小红书封面。画面不要包含任何文字，保持纯净美感。` });
  } else {
    parts.push({ text: `A professional aesthetic Xiaohongshu cover photo for: ${topic}. Style: ${styleKeywords[style] || "aesthetic"}. NO TEXT, 3:4 aspect ratio, ultra high quality.` });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "3:4",
          imageSize: "1K"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("IMAGE_MISSING");
  } catch (error: any) {
    const errorCode = handleApiError(error);
    // 如果是严重的认证错误，则抛出以便 App.tsx 拦截
    if (["AUTH_INVALID", "AUTH_NEED_RESET", "PERMISSION_DENIED"].includes(errorCode)) {
        throw new Error(errorCode);
    }
    // 否则降级使用公共生成器
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(topic + ", aesthetic style")}?width=1080&height=1440&nologo=true`;
  }
};

export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `针对话题“${topic}”，列出5个更具爆款潜质的笔记标题。以 JSON 字符串数组返回。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (e) {
    return [];
  }
};
