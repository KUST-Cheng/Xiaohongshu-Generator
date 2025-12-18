import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types.ts";

/**
 * 极简安全地获取 API Key
 * 防止 process 未定义导致的全局脚本崩溃
 */
const getApiKey = (): string | null => {
  try {
    if (typeof process !== "undefined" && process.env && process.env.API_KEY) {
      const key = process.env.API_KEY;
      if (key !== "undefined" && key.trim() !== "" && key !== "YOUR_API_KEY") {
        return key;
      }
    }
  } catch (e) {
    // 静默失败
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
      1. 生成一段英文生图描述词 (image_prompt)，用于 AI 生图。
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
    console.error("Gemini Text Generation Error:", error);
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
    emotional: "cinematic photography, soft light",
    educational: "minimalist, clean workspace",
    promotion: "luxurious product display",
    rant: "authentic urban style"
  };
  const finalPrompt = encodeURIComponent(`${basePrompt}, ${styleKeywords[style] || "aesthetic photography"}, 4k`);
  const seed = Math.floor(Math.random() * 1000000);
  return `https://image.pollinations.ai/prompt/${finalPrompt}?width=1080&height=1440&seed=${seed}&nologo=true&model=flux&enhance=true`;
};

export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `针对话题“${topic}”，给5个爆款标题。JSON数组。`,
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