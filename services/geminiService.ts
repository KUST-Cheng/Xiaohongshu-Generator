
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

// User provided free API configurations
const TEXT_FREE_KEY = "sk-Hs7IJK3zeLnYrAHIWbx8jsxknnKkC1AA140ZhktdeF5zzAvq";
const IMAGE_FREE_KEY = "sk-nBYh0WMJ0EBAxJQzpAtgG0j5G0xB8dEh09PowC5ZESx6qy7G";
const PROXY_DOMAIN = "https://yunwu.ai";

/**
 * Robust Fetch Interceptor Guard
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
 * Utility to extract and parse JSON safely from potentially messy AI output
 */
const parseSafeJson = (text: string) => {
  try {
    // 1. Clean markdown code blocks if present
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
    }
    
    // 2. Find the first '{' and last '}' to isolate the JSON object
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    
    if (startIdx === -1 || endIdx === -1) {
      throw new Error("No JSON object found");
    }
    
    cleaned = cleaned.substring(startIdx, endIdx + 1);
    
    // 3. Attempt parse
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Original text was:", text);
    throw e;
  }
};

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
    .replace(/^["']?[\w_]+["']?\s*[:：]\s*/i, '')
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
    ? "字数：约600-800字。包含详细的小红书式排版。" 
    : (length === 'short' ? "字数：150字左右。短小精悍。" : "字数：350字左右。标准篇幅。");

  const prompt = `
    你是一位资深的小红书爆款博主。请针对话题“${topic}”，以“${style}”风格创作。
    
    【核心要求】:
    1. 标题吸睛带Emoji。
    2. 正文分段，多用表情符号。
    3. ${lengthStrategy}
    
    ${isTemplateMode ? `
    【爆款模版提取要求】:
    必须提取 3 个极简文本字段用于 iOS 备忘录封面：
    - main_title: 极其震撼的主标题（10字内）。
    - highlight_text: 点睛金句（15字内）。
    - body_preview: 吸引点击的内容摘要（40字内）。
    注意：值必须是纯文本，严禁带有任何 JSON 键名或标点。
    ` : ''}

    【输出格式】: 严格返回 JSON 格式。不要输出任何 JSON 之外的文字。
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      maxOutputTokens: 1500, // 限制输出长度，防止截断
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
  if (!text) throw new Error("AI 生成失败，请缩短话题后重试");
  
  try {
    const data = parseSafeJson(text) as GeneratedPost;
    
    // 清洗数据
    data.title = sanitizeContent(data.title);
    if (data.cover_summary) {
      data.cover_summary.main_title = sanitizeContent(data.cover_summary.main_title);
      data.cover_summary.highlight_text = sanitizeContent(data.cover_summary.highlight_text);
      data.cover_summary.body_preview = sanitizeContent(data.cover_summary.body_preview);
    }
    
    return data;
  } catch (e) {
    console.warn("JSON Parse Attempt Failed. Raw text length:", text.length);
    throw new Error("生成内容过于丰富导致格式受损，请再次点击生成即可恢复。建议缩短话题长度。");
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
      text: `Create a Xiaohongshu cover style image for topic: ${topic}. Use the visual style of the reference image. 3:4 aspect ratio. NO TEXT.` 
    });
  } else {
    parts.push({ 
      text: `High-end photography for Xiaohongshu. Topic: ${topic}, Style: ${style}. Cinematic lighting, 3:4 aspect ratio, NO TEXT.` 
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
  
  throw new Error("图像生成遇到问题，请重试。");
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
    contents: `针对话题“${topic}”，给出5个差异化小红书标题。直接返回 JSON 数组。`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  try {
    return parseSafeJson(response.text || "[]");
  } catch {
    return [];
  }
};
