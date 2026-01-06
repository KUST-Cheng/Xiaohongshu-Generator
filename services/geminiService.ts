
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

// User provided free API keys for the proxy service
const DEFAULT_TEXT_KEY = "sk-Hs7IJK3zeLnYrAHIWbx8jsxknnKkC1AA140ZhktdeF5zzAvq";
const DEFAULT_IMAGE_KEY = "sk-nBYh0WMJ0EBAxJQzpAtgG0j5G0xB8dEh09PowC5ZESx6qy7G";
const PROXY_URL = "https://yunwu.ai/v1beta";

/**
 * Generate viral Xiaohongshu post text using Gemini 3 Pro.
 */
export const generatePostText = async (
  topic: string,
  style: string,
  length: string,
  isTemplateMode: boolean
): Promise<GeneratedPost> => {
  // Priority: environment key > provided free key
  const apiKey = process.env.API_KEY || DEFAULT_TEXT_KEY;
  const ai = new GoogleGenAI({ 
    apiKey,
    // Use the proxy URL provided by the user to bypass regional restrictions
    baseUrl: PROXY_URL 
  } as any);
  
  const lengthStrategy = length === 'long' 
    ? "这是一篇深度长文（约800字），需要清晰的逻辑结构、丰富的细节和多级副标题。" 
    : (length === 'short' ? "短小精悍，控制在200字以内，重点突出。" : "中等篇幅，400字左右，排版舒适。");

  const prompt = `
    你是一位拥有千万粉丝的小红书爆款博主。针对话题“${topic}”，创作一篇风格为“${style}”的爆款笔记。
    【创作要求】: 标题带 Emoji，正文有呼吸感，多用表情，结尾带 5-8 个标签。
    【篇幅策略】: ${lengthStrategy}
    ${isTemplateMode ? '同时提取封面摘要：main_title (封面主标题), highlight_text (高亮金句), body_preview (正文预览)。' : ''}
    
    必须以纯 JSON 格式返回。
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 32768 },
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
  if (!text) throw new Error("AI response was empty");
  return JSON.parse(text);
};

/**
 * Generate aesthetic cover image using Gemini 3 Pro Image.
 */
export const generatePostImage = async (
  topic: string,
  style: string,
  refImageBase64?: string
): Promise<string> => {
  const apiKey = process.env.API_KEY || DEFAULT_IMAGE_KEY;
  const ai = new GoogleGenAI({ 
    apiKey,
    baseUrl: PROXY_URL
  } as any);
  
  const parts: any[] = [];
  if (refImageBase64) {
    parts.push({ 
      inlineData: { 
        mimeType: 'image/png', 
        data: refImageBase64 
      } 
    });
    parts.push({ 
      text: `参考此图的审美风格、构图和色调，为“${topic}”生成一张小红书高审美封面图。画面严禁出现文字。` 
    });
  } else {
    parts.push({ 
      text: `Aesthetic Xiaohongshu cover photography for: ${topic}. Style: ${style}. High quality, cinematic lighting, 3:4 ratio, NO TEXT.` 
    });
  }

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
  
  throw new Error("No image data returned from Gemini");
};

/**
 * Generate brainstorming ideas for titles.
 */
export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  const apiKey = process.env.API_KEY || DEFAULT_TEXT_KEY;
  const ai = new GoogleGenAI({ 
    apiKey,
    baseUrl: PROXY_URL
  } as any);
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `针对话题“${topic}”，给出5个更有爆发力、更符合小红书语境的差异化标题方向。以 JSON 数组格式返回。`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  return JSON.parse(response.text || "[]");
};
