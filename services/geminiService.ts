
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

// User provided free API configurations
const TEXT_FREE_KEY = "sk-Hs7IJK3zeLnYrAHIWbx8jsxknnKkC1AA140ZhktdeF5zzAvq";
const IMAGE_FREE_KEY = "sk-nBYh0WMJ0EBAxJQzpAtgG0j5G0xB8dEh09PowC5ZESx6qy7G";
const PROXY_DOMAIN = "https://yunwu.ai";

/**
 * Utility to compress and resize images before sending to API.
 * This prevents "Failed to fetch" errors caused by large request payloads.
 */
const compressImage = async (base64Str: string, maxWidth = 1024): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = `data:image/png;base64,${base64Str}`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxWidth) {
          width *= maxWidth / height;
          height = maxWidth;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      // Export as JPEG with 0.8 quality to significantly reduce size
      const compressed = canvas.toDataURL('image/jpeg', 0.8);
      resolve(compressed.split(',')[1]);
    };
  });
};

/**
 * Enhanced Fetch Hijack:
 * Transparently redirects all Google AI SDK traffic to the proxy server.
 */
const originalFetch = window.fetch;
window.fetch = async function(...args: any[]) {
  let [resource, config] = args;
  
  const targetDomain = 'generativelanguage.googleapis.com';
  
  if (typeof resource === 'string' && resource.includes(targetDomain)) {
    resource = resource.replace(`https://${targetDomain}`, PROXY_DOMAIN);
  } else if (resource instanceof URL && resource.href.includes(targetDomain)) {
    resource = new URL(resource.href.replace(`https://${targetDomain}`, PROXY_DOMAIN));
  } else if (resource instanceof Request && resource.url.includes(targetDomain)) {
    // If it's a Request object, we need to clone it with the new URL
    const newUrl = resource.url.replace(`https://${targetDomain}`, PROXY_DOMAIN);
    resource = new Request(newUrl, resource);
  }

  return originalFetch(resource, config);
};

/**
 * Generate viral Xiaohongshu post text
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
    注意：摘要内容必须是地道、感性的中文，严禁出现任何 JSON 键名、技术术语、英文描述或类似代码的字符。
    ` : ''}
    
    必须以纯 JSON 格式返回。
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 16000 },
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
  if (!text) throw new Error("AI 返回内容为空");
  
  const data = JSON.parse(text) as GeneratedPost;
  // Post-processing to remove any accidental field names in values
  if (data.cover_summary) {
    Object.keys(data.cover_summary).forEach(key => {
        const k = key as keyof typeof data.cover_summary;
        if (data.cover_summary![k]) {
            data.cover_summary![k] = data.cover_summary![k].replace(/^(main_title|highlight_text|body_preview)[:：\s]*/i, '').trim();
        }
    });
  }
  
  return data;
};

/**
 * Generate aesthetic cover image
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
    // Compress the image to ensure the request is not rejected for being too large
    const processedImage = await compressImage(refImageBase64);
    
    parts.push({ 
      inlineData: { 
        mimeType: 'image/jpeg', 
        data: processedImage 
      } 
    });
    parts.push({ 
      text: `Create a new aesthetic Xiaohongshu cover inspired by the style, lighting, and mood of the provided image.
      Topic: ${topic}.
      Instructions: High-end photography, cinematic lighting, 3:4 aspect ratio. DO NOT include any text or watermarks.` 
    });
  } else {
    parts.push({ 
      text: `High-end aesthetic photography for Xiaohongshu cover. Topic: ${topic}. Style: ${style}. Soft cinematic lighting, shallow depth of field, 3:4 aspect ratio, NO TEXT.` 
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

  // Extract image from response parts
  const candidate = response.candidates?.[0];
  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  }
  
  throw new Error("模型未能生成图像，请尝试更换话题或重试");
};

/**
 * Brainstorm viral titles
 */
export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  const apiKey = process.env.API_KEY || TEXT_FREE_KEY;
  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `针对话题“${topic}”，给出5个更有爆发力、更符合小红书语境的差异化标题。返回 JSON 字符串数组。`,
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
