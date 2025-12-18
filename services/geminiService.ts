
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

/**
 * 核心逻辑：直接使用注入的 process.env.API_KEY
 * 遵循规范：在调用前即时实例化
 */
export const generatePostText = async (
  topic: string,
  style: string,
  length: string,
  isTemplateMode: boolean
): Promise<GeneratedPost> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const lengthStrategy = length === 'long' 
    ? "这是一篇长笔记（800字左右），需要多级副标题和深度内容。" 
    : (length === 'short' ? "短小精悍，200字内。" : "标准篇幅，400字左右。");

  const prompt = `
    你是一位拥有百万粉丝的小红书顶级博主。
    请围绕话题“${topic}”创作一篇风格为“${style}”的爆款笔记。
    篇幅要求：${lengthStrategy}
    
    输出要求：
    1. 标题要吸引人，正文多用 Emoji，排版有呼吸感。
    2. 生成 5-8 个相关的爆款标签。
    ${isTemplateMode ? '3. 提供封面所需的：main_title (主标题), highlight_text (金句), body_preview (简短摘要)。' : ''}
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
  if (!text) throw new Error("AI 返回了空内容");
  return JSON.parse(text);
};

export const generatePostImage = async (
  topic: string,
  style: string,
  refImageBase64?: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const styleKeywords: Record<string, string> = {
    emotional: "soft, healing, cinematic lighting",
    educational: "minimalist, clean, workspace",
    promotion: "commercial, vibrant, luxury",
    rant: "authentic, street style, high contrast"
  };

  const parts: any[] = [];
  if (refImageBase64) {
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: refImageBase64,
      },
    });
    parts.push({ text: `基于这张图的构图和色调，为话题“${topic}”生成一张小红书风格封面图，不要包含文字。` });
  } else {
    parts.push({ text: `A high-quality aesthetic Xiaohongshu cover image for: ${topic}. Style: ${styleKeywords[style] || "aesthetic"}. 3:4 aspect ratio, no text.` });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: "3:4"
      }
    }
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  
  throw new Error("无法生成图片，请重试");
};

export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `针对话题“${topic}”，提供5个更具吸引力的小红书爆款切入点。以 JSON 字符串数组返回。`,
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
