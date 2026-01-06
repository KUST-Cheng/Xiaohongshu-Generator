
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

// User provided free API configurations
const TEXT_FREE_KEY = "sk-Hs7IJK3zeLnYrAHIWbx8jsxknnKkC1AA140ZhktdeF5zzAvq";
const IMAGE_FREE_KEY = "sk-nBYh0WMJ0EBAxJQzpAtgG0j5G0xB8dEh09PowC5ZESx6qy7G";
const PROXY_DOMAIN = "https://yunwu.ai";

/**
 * Robust Fetch Interceptor Guard
 * Prevents multiple wrappings and handles all Request/URL/String variants correctly.
 */
if (!(window as any).__FETCH_HIJACKED__) {
  const originalFetch = window.fetch;
  (window as any).originalFetch = originalFetch;
  window.fetch = async function(resource: string | Request | URL, config?: RequestInit) {
    const targetDomain = 'generativelanguage.googleapis.com';
    let url = '';

    if (typeof resource === 'string') {
      url = resource;
    } else if (resource instanceof URL) {
      url = resource.href;
    } else if (resource instanceof Request) {
      url = resource.url;
    }

    if (url.includes(targetDomain)) {
      const newUrl = url.replace(`https://${targetDomain}`, PROXY_DOMAIN);
      
      // If it's a Request object, we must clone it for the new URL
      if (resource instanceof Request) {
        const { method, headers, body, mode, credentials, cache, redirect, referrer, integrity, signal } = resource;
        // Note: body cannot be reused easily if it's a stream, 
        // but for standard SDK calls it works fine.
        const newRequest = new Request(newUrl, {
          method, headers, body, mode, credentials, cache, redirect, referrer, integrity, signal
        });
        return originalFetch(newRequest);
      }
      
      return originalFetch(newUrl, config);
    }

    return originalFetch(resource, config);
  };
  (window as any).__FETCH_HIJACKED__ = true;
}

/**
 * Utility to compress and resize images
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
      const compressed = canvas.toDataURL('image/jpeg', 0.7);
      resolve(compressed.split(',')[1]);
    };
  });
};

/**
 * Strips accidental JSON keys or code patterns from strings
 */
const sanitizeContent = (text: string): string => {
  if (!text) return "";
  return text
    // Remove "key": or key: patterns at the start of strings
    .replace(/^["']?[\w_]+["']?\s*[:：]\s*/i, '')
    // Remove any trailing quotes if AI accidentally wrapped the value
    .replace(/^["']|["']$/g, '')
    .trim();
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
    【核心要求】: 
    1. 标题吸睛，多用 Emoji。
    2. 正文排版要有呼吸感。
    3. 严禁在生成的文字内容中包含任何 JSON 字段名、变量名或代码标记（如 "title": 等）。
    
    【篇幅策略】: ${lengthStrategy}
    
    ${isTemplateMode ? `
    【爆款模版生成指令】:
    请为 iOS 备忘录封面提取关键摘要。
    - main_title: 核心大标题（3-10字）。
    - highlight_text: 高亮痛点或金句（15字内）。
    - body_preview: 吸引点击的精彩预览（40字内）。
    注意：这些字段的值必须是纯文字，绝对不能带有任何冒号、引号或字段名称。
    ` : ''}
    
    必须返回 JSON 格式。
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      // Reduced thinking budget slightly to avoid proxy timeouts on repeated calls
      thinkingConfig: { thinkingBudget: 8000 },
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
  if (!text) throw new Error("AI 返回内容为空，请再次点击生成");
  
  const data = JSON.parse(text) as GeneratedPost;
  
  // Sanitize all output fields
  data.title = sanitizeContent(data.title);
  if (data.cover_summary) {
    data.cover_summary.main_title = sanitizeContent(data.cover_summary.main_title);
    data.cover_summary.highlight_text = sanitizeContent(data.cover_summary.highlight_text);
    data.cover_summary.body_preview = sanitizeContent(data.cover_summary.body_preview);
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
    const processedImage = await compressImage(refImageBase64);
    parts.push({ 
      inlineData: { 
        mimeType: 'image/jpeg', 
        data: processedImage 
      } 
    });
    parts.push({ 
      text: `Generate a new Xiaohongshu cover inspired by the style of this image. Topic: ${topic}. High-end photography, cinematic, 3:4 aspect ratio. NO TEXT.` 
    });
  } else {
    parts.push({ 
      text: `Aesthetic Xiaohongshu cover photography, topic: ${topic}, style: ${style}. High quality, 3:4 aspect ratio, NO TEXT.` 
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

  const candidate = response.candidates?.[0];
  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  }
  
  throw new Error("图像生成遇到问题，请重试");
};

/**
 * Get viral titles
 */
export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  const apiKey = process.env.API_KEY || TEXT_FREE_KEY;
  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `针对话题“${topic}”，给出5个小红书风格标题。返回 JSON 数组。`,
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
