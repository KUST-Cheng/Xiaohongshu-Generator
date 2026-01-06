
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

/**
 * 核心逻辑：直接使用注入的 process.env.API_KEY
 * 按照规范，在每次调用前即时实例化 GoogleGenAI。
 */
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
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
  const ai = getAiClient();
  
  const lengthStrategy = length === 'long' 
    ? "这是一篇深度长文（约800字），需要多级副标题、详细的步骤或见解。" 
    : (length === 'short' ? "短小精悍，控制在200字以内，重点突出。" : "中等篇幅，400字左右，排版舒适。");

  const prompt = `
    你是一位拥有千万粉丝的小红书爆款博主，擅长捕捉热点、制造共鸣。
    话题：${topic}
    风格：${style}
    篇幅：${lengthStrategy}
    
    【创作指南】
    1. 标题：极具吸引力，包含 2-3 个关键词，使用表情符号。
    2. 正文：排版优雅，多用 Emoji，语感亲切。
    3. 标签：生成 5-10 个热点标签。
    ${isTemplateMode ? '4. 封面文案：针对 iOS 备忘录风格，提取 main_title (主标题), highlight_text (金句), body_preview (简短摘要)。' : ''}
    
    请严格按照 JSON 格式输出，不要包含任何 Markdown 代码块包裹。
  `;

  try {
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
    if (!text) throw new Error("AI 响应内容为空");
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Gemini Text Error:", error);
    if (error.message?.includes("API key not valid") || error.message?.includes("API_KEY_NOT_CONFIGURED")) {
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
  const ai = getAiClient();
  
  const styleKeywords: Record<string, string> = {
    emotional: "cinematic film, soft lighting, healing atmosphere",
    educational: "clean flatlay, aesthetic workspace, minimalist",
    promotion: "premium product photography, studio lighting",
    rant: "realistic street style, high contrast, authentic"
  };

  const parts: any[] = [];
  if (refImageBase64) {
    parts.push({
      inlineData: { mimeType: 'image/png', data: refImageBase64 }
    });
    parts.push({ text: `Based on this reference image's composition and color, generate an aesthetic Xiaohongshu cover for "${topic}". NO TEXT.` });
  } else {
    parts.push({ text: `A high-quality aesthetic Xiaohongshu cover photo for: ${topic}. Style: ${styleKeywords[style] || "aesthetic"}. 3:4 aspect ratio, no text.` });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: { aspectRatio: "3:4" }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("未生成有效图片");
  } catch (error: any) {
    console.error("Gemini Image Error:", error);
    // 降级使用公共生成器
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(topic + " aesthetic style")}?width=1080&height=1440&nologo=true`;
  }
};

export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `针对话题“${topic}”，提供5个小红书爆款标题。以 JSON 字符串数组返回。`,
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
