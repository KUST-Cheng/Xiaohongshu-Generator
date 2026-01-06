
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
 * Attempts to repair a truncated JSON string by closing unclosed quotes, brackets, and braces.
 */
const tryRepairJson = (jsonStr: string): string => {
  let repaired = jsonStr.trim();
  
  // Count unclosed structures
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (char === '\\' && !escaped) {
      escaped = true;
      continue;
    }
    if (char === '"' && !escaped) {
      inString = !inString;
    }
    if (!inString) {
      if (char === '{') openBraces++;
      if (char === '}') openBraces--;
      if (char === '[') openBrackets++;
      if (char === ']') openBrackets--;
    }
    escaped = false;
  }

  // Repair sequence
  if (inString) repaired += '"';
  while (openBrackets > 0) { repaired += ']'; openBrackets--; }
  while (openBraces > 0) { repaired += '}'; openBraces--; }

  return repaired;
};

/**
 * Utility to extract and parse JSON safely from potentially messy AI output
 */
const parseSafeJson = (text: string) => {
  let cleaned = text.trim();
  
  // 1. Strip Markdown wrappers
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
  }
  
  // 2. Find JSON boundaries
  const startIdx = cleaned.indexOf('{');
  const endIdx = cleaned.lastIndexOf('}');
  
  if (startIdx === -1) throw new Error("Missing JSON start");

  // If no closing brace, try to repair it
  let jsonPart = endIdx === -1 ? cleaned.substring(startIdx) : cleaned.substring(startIdx, endIdx + 1);
  
  try {
    return JSON.parse(jsonPart);
  } catch (e) {
    // Attempt deep repair
    try {
      const repaired = tryRepairJson(jsonPart);
      return JSON.parse(repaired);
    } catch (deepError) {
      console.error("Critical Parse Error. Fragment:", jsonPart.slice(-50));
      throw new Error("JSON_STILL_BROKEN");
    }
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
  
  // Adjust instruction for length to be more specific to help model manage tokens
  const lengthStrategy = length === 'long' 
    ? "字数：约700-800字。内容需极度详实，分多段撰写，包含具体的步骤、心得或故事细节。" 
    : (length === 'short' ? "字数：150字以内。重点突出，爆发力强。" : "字数：350字左右。标准深度。");

  const prompt = `
    你是一位资深的小红书爆款博主。针对话题“${topic}”，以“${style}”风格创作。
    
    【核心要求】:
    1. 标题必须极其吸睛，包含 2-3 个 Emoji。
    2. 正文必须分段，每段开头建议使用 Emoji。
    3. ${lengthStrategy}
    4. 结尾包含 5-8 个热门标签。
    
    ${isTemplateMode ? `
    【封面摘要】:
    同步提取 3 个字段用于封面展示：
    - main_title: 震撼的主标题 (10字内)。
    - highlight_text: 点睛金句 (15字内)。
    - body_preview: 吸引点击的内容摘要 (40字内)。
    ` : ''}

    【返回格式】: 严格返回 JSON 对象。不要输出任何解释性文字。
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      maxOutputTokens: 4096, // 关键：大幅提升输出上限以防长文断开
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
  if (!text) throw new Error("AI 未返回内容，请重试");
  
  try {
    const data = parseSafeJson(text) as GeneratedPost;
    
    // Data Sanitization
    data.title = sanitizeContent(data.title);
    if (data.cover_summary) {
      data.cover_summary.main_title = sanitizeContent(data.cover_summary.main_title);
      data.cover_summary.highlight_text = sanitizeContent(data.cover_summary.highlight_text);
      data.cover_summary.body_preview = sanitizeContent(data.cover_summary.body_preview);
    }
    
    return data;
  } catch (e) {
    console.error("JSON Error. Raw text snippet:", text.substring(0, 100) + "...");
    throw new Error("由于生成内容极长，格式解析遇到挑战。请尝试再次生成，或稍微缩短话题要求。");
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
      text: `Social media cover for topic: ${topic}. Adopt the lighting and mood of the provided image. High-end aesthetic, 3:4 aspect ratio. NO TEXT.` 
    });
  } else {
    parts.push({ 
      text: `Professional aesthetic photography for Xiaohongshu cover. Topic: ${topic}, Style: ${style}. Cinematic, high definition, 3:4 aspect ratio, NO TEXT.` 
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
    contents: `针对话题“${topic}”，给出5个吸引人的小红书标题。返回 JSON 字符串数组。`,
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
