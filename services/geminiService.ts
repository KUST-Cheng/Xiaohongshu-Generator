
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

// 用户提供的免费 API 配置
const TEXT_FREE_KEY = "sk-Hs7IJK3zeLnYrAHIWbx8jsxknnKkC1AA140ZhktdeF5zzAvq";
const IMAGE_FREE_KEY = "sk-nBYh0WMJ0EBAxJQzpAtgG0j5G0xB8dEh09PowC5ZESx6qy7G";
const PROXY_DOMAIN = "https://yunwu.ai";

/**
 * 核心修复：劫持 fetch 请求。
 * @google/genai SDK 内部使用 fetch。通过替换 URL 域名，
 * 强制让 SDK 与中转站通信，从而使 sk-... 格式的密钥生效。
 */
const originalFetch = window.fetch;
window.fetch = function(...args: any[]) {
  if (typeof args[0] === 'string' && args[0].includes('generativelanguage.googleapis.com')) {
    args[0] = args[0].replace('https://generativelanguage.googleapis.com', PROXY_DOMAIN);
  }
  return originalFetch.apply(this, args as any);
};

/**
 * 生成爆款文案 - 使用专用文案密钥
 */
export const generatePostText = async (
  topic: string,
  style: string,
  length: string,
  isTemplateMode: boolean
): Promise<GeneratedPost> => {
  // 优先使用环境变量，否则使用提供的免费文案密钥
  const apiKey = process.env.API_KEY || TEXT_FREE_KEY;
  const ai = new GoogleGenAI({ apiKey });
  
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
  if (!text) throw new Error("AI 返回文案为空，请重试");
  return JSON.parse(text);
};

/**
 * 生成爆款封面 - 使用专用图片密钥
 */
export const generatePostImage = async (
  topic: string,
  style: string,
  refImageBase64?: string
): Promise<string> => {
  const apiKey = process.env.API_KEY || IMAGE_FREE_KEY;
  const ai = new GoogleGenAI({ apiKey });
  
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
      text: `Professional aesthetic photography for Xiaohongshu cover, topic: ${topic}, style: ${style}. High quality, cinematic lighting, 3:4 aspect ratio, NO TEXT ON IMAGE.` 
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
  
  throw new Error("图像模型未返回有效数据");
};

/**
 * 获取灵感标题
 */
export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  const apiKey = process.env.API_KEY || TEXT_FREE_KEY;
  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `针对话题“${topic}”，给出5个更有爆发力、更符合小红书语境的差异化标题方向。以 JSON 字符串数组格式返回。`,
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
