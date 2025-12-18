import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

/**
 * 极其安全地尝试获取 API Key
 * 兼容 Vite、Webpack 以及各种浏览器环境，防止 ReferenceError
 */
const getApiKey = (): string | null => {
  try {
    // 使用 globalThis 访问以防止 ReferenceError: process is not defined
    const g = globalThis as any;
    const key = g.process?.env?.API_KEY;
    if (key && key !== "undefined" && key.trim() !== "" && key !== "YOUR_API_KEY") {
      return key;
    }
  } catch (e) {
    // 忽略任何环境检测错误
  }
  return null;
};

const getClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
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
    const ai = getClient();
    const prompt = `
      你是一位拥有百万粉丝的小红书爆款博主。
      请根据以下信息创作一篇极具吸引力的笔记：
      - 主题: ${topic}
      - 风格: ${style}
      - 长度: ${length}

      要求：标题有冲击力，正文多用 Emoji。
      
      特别任务：
      1. 生成一段简短的英文生图描述词 (image_prompt)，用于 AI 生图。
      2. ${isTemplateMode ? '提取封面信息：main_title, highlight_text, body_preview。' : 'cover_summary 设为 null。'}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            image_prompt: { type: Type.STRING },
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
          required: ["title", "content", "tags", "image_prompt"]
        }
      },
    });

    const text = response.text;
    if (!text) throw new Error("EMPTY_RESPONSE");
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Gemini Gen Error:", error);
    const msg = error.message || "";
    if (msg.includes("401") || msg.includes("403")) throw new Error("INVALID_API_KEY");
    if (msg.includes("429")) throw new Error("QUOTA_EXCEEDED");
    throw error;
  }
};

export const generatePostImage = async (
  topic: string,
  style: string,
  aiImagePrompt?: string
): Promise<string> => {
  const basePrompt = aiImagePrompt || topic;
  const styleKeywords: Record<string, string> = {
    emotional: "cinematic photography, healing vibes",
    educational: "minimalist, professional workspace",
    promotion: "luxurious aesthetic product display",
    rant: "authentic urban realism"
  };
  const finalPrompt = encodeURIComponent(`${basePrompt}, ${styleKeywords[style] || "high quality photography"}, 4k, no text`);
  const seed = Math.floor(Math.random() * 1000000);
  return `https://image.pollinations.ai/prompt/${finalPrompt}?width=1080&height=1440&seed=${seed}&nologo=true&model=flux&enhance=true`;
};

export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `针对话题“${topic}”，给5个爆款标题。JSON数组格式。`,
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