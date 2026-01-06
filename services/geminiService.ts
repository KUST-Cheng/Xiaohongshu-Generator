
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

// 用户提供的免费 API 配置
const TEXT_FREE_KEY = "sk-Hs7IJK3zeLnYrAHIWbx8jsxknnKkC1AA140ZhktdeF5zzAvq";
const IMAGE_FREE_KEY = "sk-nBYh0WMJ0EBAxJQzpAtgG0j5G0xB8dEh09PowC5ZESx6qy7G";
const PROXY_DOMAIN = "https://yunwu.ai";

/**
 * 强化版 Fetch 劫持：
 * 确保完整转发所有参数，包括大容量的图片数据和特殊的请求头。
 */
const originalFetch = window.fetch;
window.fetch = async function(...args: any[]) {
  let [resource, config] = args;
  
  if (typeof resource === 'string' && resource.includes('generativelanguage.googleapis.com')) {
    resource = resource.replace('https://generativelanguage.googleapis.com', PROXY_DOMAIN);
  } else if (resource instanceof URL && resource.href.includes('generativelanguage.googleapis.com')) {
    resource = new URL(resource.href.replace('https://generativelanguage.googleapis.com', PROXY_DOMAIN));
  }

  return originalFetch(resource, config);
};

/**
 * 生成爆款文案
 */
export const generatePostText = async (
  topic: string,
  style: string,
  length: string,
  isTemplateMode: boolean
): Promise<GeneratedPost> => {
  const apiKey = process.env.API_KEY || TEXT_FREE_KEY;
  const ai = new GoogleGenAI({ apiKey });
  
  const lengthStrategy = length === 'long' 
    ? "这是一篇深度长文（约800字），需要清晰的逻辑结构、丰富的细节和多级副标题。" 
    : (length === 'short' ? "短小精悍，控制在200字以内，重点突出。" : "中等篇幅，400字左右，排版舒适。");

  const prompt = `
    你是一位拥有千万粉丝的小红书爆款博主。针对话题“${topic}”，创作一篇风格为“${style}”的爆款笔记。
    【创作要求】: 标题带 Emoji，正文有呼吸感，多用表情，结尾带 5-8 个标签。
    【篇幅策略】: ${lengthStrategy}
    
    ${isTemplateMode ? `
    【特别指令 - 封面摘要】: 
    请为 iOS 备忘录模版生成摘要内容。
    - main_title: 极其吸睛的笔记主标题（3-8字）。
    - highlight_text: 一句有力的话或痛点金句（15字以内）。
    - body_preview: 正文的核心精华预览（30-50字）。
    注意：摘要内容必须是地道、感性的中文，严禁出现任何 JSON 键名（如 "main_title"）、技术术语、英文描述或类似代码的字符。
    ` : ''}
    
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
  
  // 简单清洗，防止 AI 在字段中混入多余的引导词
  const data = JSON.parse(text) as GeneratedPost;
  if (data.cover_summary) {
    Object.keys(data.cover_summary).forEach(key => {
        const k = key as keyof typeof data.cover_summary;
        if (data.cover_summary![k]) {
            data.cover_summary![k] = data.cover_summary![k].replace(/^(main_title|highlight_text|body_preview)[:：\s]*/i, '');
        }
    });
  }
  
  return data;
};

/**
 * 生成爆款封面
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
    // 确保图片部分在 Prompt 之前，有助于模型理解参考关系
    parts.push({ 
      inlineData: { 
        mimeType: 'image/png', 
        data: refImageBase64 
      } 
    });
    parts.push({ 
      text: `Task: Generate a new aesthetic cover for Xiaohongshu. 
      Topic: ${topic}. 
      Reference: Use the provided image for composition, lighting, and color palette inspiration. 
      Requirement: Professional photography, NO text on image, 3:4 aspect ratio, high definition.` 
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
  
  throw new Error("图像模型生成超时或未返回数据，请检查网络或重试");
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
