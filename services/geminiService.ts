
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

/**
 * 动态获取 AI 客户端实例
 * 每次调用都会读取最新的 process.env.API_KEY，防止因环境注入延迟导致的 Key 缺失报错
 */
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined" || apiKey === "YOUR_API_KEY" || apiKey.trim() === "") {
    throw new Error("API_KEY_NOT_CONFIGURED");
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
    const prompt = `
      你是一位拥有百万粉丝的小红书爆款博主。
      请根据以下信息创作一篇极具吸引力的笔记：
      - 主题: ${topic}
      - 风格: ${style}
      - 长度: ${length}

      要求：
      1. 标题：充满悬念或情绪，控制在20字内。
      2. 正文：多用 Emoji，段落短小，带有强烈的个人色彩和互动感。
      3. 生成 image_prompt：描述一张符合本笔记意境的高质量背景图（英文描述）。
      4. 如果 isTemplateMode 为真，提取封面关键信息：main_title, highlight_text, body_preview。
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
    // 识别特定错误：项目未启用 API 或密钥无效
    if (msg.includes("Requested entity was not found") || msg.includes("403") || msg.includes("401")) {
      throw new Error("AUTH_FAILED");
    }
    if (msg.includes("429")) throw new Error("QUOTA_EXCEEDED");
    throw error;
  }
};

export const generatePostImage = async (
  topic: string,
  style: string,
  aiImagePrompt?: string
): Promise<string> => {
  const promptText = aiImagePrompt || topic;
  
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `A high-quality Xiaohongshu style aesthetic photo: ${promptText}, high resolution, cinematic lighting, 4k` }] },
      config: {
        imageConfig: {
          aspectRatio: "3:4"
        }
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("NO_IMAGE_DATA");
  } catch (e) {
    console.warn("Gemini Image Gen failed, using fallback engine", e);
    // 降级使用备用生图引擎，确保封面不为空
    const seed = Math.floor(Math.random() * 1000000);
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText + ", aesthetic, soft lighting")}?width=1080&height=1440&seed=${seed}&nologo=true`;
  }
};

export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `针对话题“${topic}”，给5个爆款标题，直接返回JSON数组字符串。`,
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
