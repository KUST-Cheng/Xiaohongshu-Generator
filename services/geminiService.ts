
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

/**
 * Creates a new GoogleGenAI client instance using the mandatory process.env.API_KEY.
 * Always initialized right before use to ensure the correct environment state.
 */
const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generatePostText = async (
  topic: string,
  style: string,
  length: string,
  isTemplateMode: boolean
): Promise<GeneratedPost> => {
  try {
    const ai = getAi();
    const prompt = `
      你是一位顶级小红书博主。请根据以下信息创作笔记：
      主题: ${topic}
      风格: ${style}
      篇幅: ${length}

      要求：
      1. 标题：充满悬念或情绪，控制在20字内。
      2. 正文：逻辑分明，段落短小，大量使用 Emoji。
      3. 生成 image_prompt：描述一张符合本笔记的高质量、INS风格背景图（英文）。
      4. 如果 isTemplateMode 为真，提取：main_title, highlight_text, body_preview。
    `;

    // Using gemini-3-flash-preview for general text tasks
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
    if (!text) throw new Error("API_EMPTY_RESPONSE");
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Gemini Error:", error);
    const msg = error.message || "";
    if (msg.includes("Requested entity was not found")) throw new Error("KEY_NOT_FOUND_ON_PROJECT");
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
  // Fallback for image generation in case of failures
  const fallback = () => {
    const seed = Math.floor(Math.random() * 1000000);
    const prompt = encodeURIComponent(`${aiImagePrompt || topic}, aesthetic, high resolution, soft lighting`);
    return `https://image.pollinations.ai/prompt/${prompt}?width=1080&height=1440&seed=${seed}&nologo=true&model=flux`;
  };

  try {
    const ai = getAi();
    // Using gemini-2.5-flash-image for general image generation tasks
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: aiImagePrompt || topic }] },
      config: { imageConfig: { aspectRatio: "3:4" } }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        // Correctly handle the inlineData from the response
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return fallback();
  } catch (e) {
    return fallback();
  }
};

export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `给话题“${topic}”提供5个爆款标题，JSON数组格式。`,
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
