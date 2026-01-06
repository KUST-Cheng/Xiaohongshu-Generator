
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
    img.onerror = () => resolve(base64Str);
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
    ? "字数要求：约800字左右。结构完整，包含开头、详细干货/经历、总结。禁止生成超过4000字符的废话。" 
    : (length === 'short' ? "字数要求：200字以内。短小精悍，核心卖点明确。" : "字数要求：400字左右。中规中矩，排版美观。");

  const prompt = `
    你是一位资深的小红书爆款博主。针对话题“${topic}”，创作一篇风格为“${style}”的爆款笔记。
    
    【核心任务】:
    1. 标题必须有点击欲望，包含 Emoji。
    2. 正文使用分段式排版，多用表情符号，增加易读性。
    3. ${lengthStrategy}
    
    ${isTemplateMode ? `
    【爆款模版特殊提取】:
    请同步提取 3 个极简字段用于封面：
    - main_title: 极其震撼的笔记主标题（不超过10字）。
    - highlight_text: 一句点睛之笔或金句（不超过15字）。
    - body_preview: 最吸引人的正文预览（不超过40字）。
    注意：值必须是纯文本，严禁包含任何代码格式、JSON 键名或标点。
    ` : ''}

    【格式要求】: 严格返回 JSON。
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      // 移除 thinkingBudget 以免干扰输出 Token 限制，并防止生成超长非预期内容
      maxOutputTokens: 2048,
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
  if (!text) throw new Error("AI 生成的内容由于过长或安全策略被截断，请尝试缩短话题或重试");
  
  try {
    const data = JSON.parse(text) as GeneratedPost;
    
    // 再次清洗数据，确保没有 JSON 键名混入
    data.title = sanitizeContent(data.title);
    if (data.cover_summary) {
      data.cover_summary.main_title = sanitizeContent(data.cover_summary.main_title);
      data.cover_summary.highlight_text = sanitizeContent(data.cover_summary.highlight_text);
      data.cover_summary.body_preview = sanitizeContent(data.cover_summary.body_preview);
    }
    
    return data;
  } catch (e) {
    console.error("JSON Parse Error. Full Text:", text);
    throw new Error("内容解析失败，可能是由于 AI 生成的内容过长导致截断。请再点一次生成，通常即可恢复正常。");
  }
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
      text: `Task: Create a social media cover image (Xiaohongshu style). Topic: ${topic}. Inspiration: Use the lighting and aesthetic style of the provided reference image. Aspect ratio 3:4. NO TEXT.` 
    });
  } else {
    parts.push({ 
      text: `Professional aesthetic photography for Xiaohongshu cover. Topic: ${topic}, Style: ${style}. High definition, cinematic lighting, 3:4 aspect ratio, NO TEXT.` 
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
  
  throw new Error("图像生成遇到问题，请重新点击生成。");
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
    contents: `针对话题“${topic}”，给出5个小红书风格标题。返回 JSON 字符串数组。`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  try {
    return JSON.parse(response.text || "[]");
  } catch {
    return [];
  }
};
