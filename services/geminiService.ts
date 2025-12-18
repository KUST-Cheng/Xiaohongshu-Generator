import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

/**
 * 安全获取 API Key
 * 优先从环境变量获取，增加对 process 对象的检测以防报错
 */
const getApiKey = () => {
  try {
    const key = process.env.API_KEY;
    if (key && key !== "undefined" && key.trim() !== "" && key !== "YOUR_API_KEY") {
      return key;
    }
  } catch (e) {
    // 忽略 process 不存在的错误
  }
  return null;
};

/**
 * 获取 AI 实例
 * 每次请求时动态创建，确保获取到最新的 Key
 */
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

      要求：
      1. 标题有冲击力。
      2. 正文分段清晰，多用 Emoji。
      3. 生成 3-5 个热门标签。
      
      特别任务：
      1. 生成一段简短的英文生图描述词 (image_prompt)，描述一张高质量、无文字、适合做封面的摄影图片。
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
    console.error("Text Gen Error:", error);
    const msg = error.message || "";
    if (msg.includes("401") || msg.includes("403") || msg.includes("invalid")) throw new Error("INVALID_API_KEY");
    if (msg.includes("429") || msg.includes("quota")) throw new Error("QUOTA_EXCEEDED");
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
    emotional: "cinematic, healing, moody",
    educational: "minimalist, clean, bright",
    promotion: "luxurious, high-end, trendy",
    rant: "urban, gritty, realistic"
  };
  const finalPrompt = encodeURIComponent(`${basePrompt}, ${styleKeywords[style] || "aesthetic photography"}, 4k, no text`);
  const seed = Math.floor(Math.random() * 1000000);
  return `https://image.pollinations.ai/prompt/${finalPrompt}?width=1080&height=1440&seed=${seed}&nologo=true&model=flux&enhance=true`;
};

export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `针对话题“${topic}”，给出5个小红书爆款标题。JSON数组格式。`,
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