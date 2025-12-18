
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

/**
 * 初始化 AI 实例
 * 遵循规范：直接使用 process.env.API_KEY
 */
const createAiClient = () => {
  // 必须直接使用 process.env.API_KEY 字符串
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generatePostText = async (
  topic: string,
  style: string,
  length: string,
  isTemplateMode: boolean
): Promise<GeneratedPost> => {
  try {
    const ai = createAiClient();
    
    const isLong = length === 'long';
    const modelName = isLong ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    
    const lengthStrategy = isLong 
      ? `这是一篇长笔记（800字以上）。请确保：
         1. 钩子开头；
         2. 使用 3-4 个带 Emoji 的副标题划分段落；
         3. 结尾有行动号召（CTA）。`
      : (length === 'short' ? "短小精悍，200字内。" : "标准长度，400字左右。");

    const prompt = `
      你是一位小红书爆款专家。请根据以下信息创作：
      - 主题: ${topic}
      - 风格: ${style}
      - 策略: ${lengthStrategy}

      要求：JSON格式，包含 title, content, tags。
      ${isTemplateMode ? '同时提取封面信息：main_title, highlight_text, body_preview。' : ''}
    `;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
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

    if (!response.text) throw new Error("EMPTY_RESPONSE");
    return JSON.parse(response.text);
  } catch (error: any) {
    console.error("Text Gen Error:", error);
    const msg = error.message || "";
    // 如果返回 401 或 403，说明环境变量的 Key 失效或泄露，需要用户提供自己的 Key
    if (msg.includes("401") || msg.includes("403") || msg.includes("API key")) {
      throw new Error("AUTH_FAILED");
    }
    throw error;
  }
};

export const generatePostImage = async (
  topic: string,
  style: string,
  refImageBase64?: string
): Promise<string> => {
  try {
    const ai = createAiClient();
    const styleKeywords: Record<string, string> = {
      emotional: "healing, cinematic, soft lighting",
      educational: "minimalist, clean, top view",
      promotion: "product photography, high quality, luxury",
      rant: "street style, authentic, dramatic"
    };

    const parts: any[] = [];
    if (refImageBase64) {
      parts.push({ inlineData: { mimeType: 'image/png', data: refImageBase64 } });
      parts.push({ text: `Generate a new Xiaohongshu cover for "${topic}" based on this image style.` });
    } else {
      parts.push({ text: `High quality aesthetic Xiaohongshu cover: ${topic}. Style: ${styleKeywords[style] || "aesthetic"}. 3:4 aspect ratio.` });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts },
      config: { imageConfig: { aspectRatio: "3:4" } }
    });

    const imageData = response.candidates?.[0]?.content?.parts.find(p => p.inlineData)?.inlineData?.data;
    if (imageData) return `data:image/png;base64,${imageData}`;
    throw new Error("IMAGE_FAILED");
  } catch (error) {
    console.warn("Image gen fallback triggered.");
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(topic + ", aesthetic, cinematic")}?width=1080&height=1440&nologo=true`;
  }
};

export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  try {
    const ai = createAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `提供话题“${topic}”的5个爆款切入点。JSON数组。`,
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
