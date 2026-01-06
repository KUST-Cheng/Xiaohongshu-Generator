
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
 * Aggressive JSON Repair Utility
 * This function attempts to close any unclosed strings, objects, or arrays.
 * Critical for long text generation which might be cut off mid-sentence.
 */
const tryRepairJson = (jsonStr: string): string => {
  let repaired = jsonStr.trim();
  
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

  // Close unclosed structures
  if (inString) repaired += '"';
  while (openBrackets > 0) { repaired += ']'; openBrackets--; }
  while (openBraces > 0) { repaired += '}'; openBraces--; }

  return repaired;
};

/**
 * Intelligent JSON Extractor and Parser
 */
const parseSafeJson = (text: string) => {
  let cleaned = text.trim();
  
  // Strip Markdown markers
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  
  // Find the true JSON start
  const startIdx = cleaned.indexOf('{');
  const startBracketIdx = cleaned.indexOf('[');
  
  // Decide which structural element starts first
  let targetStart = -1;
  if (startIdx !== -1 && startBracketIdx !== -1) targetStart = Math.min(startIdx, startBracketIdx);
  else if (startIdx !== -1) targetStart = startIdx;
  else if (startBracketIdx !== -1) targetStart = startBracketIdx;

  if (targetStart === -1) throw new Error("No valid JSON structure found in AI response.");

  // Cut text to start from the first brace/bracket
  let jsonCandidate = cleaned.substring(targetStart);
  
  // Find the last corresponding closing character
  const isObject = jsonCandidate.startsWith('{');
  const lastCloseIdx = isObject ? jsonCandidate.lastIndexOf('}') : jsonCandidate.lastIndexOf(']');

  // If we have a closing tag, try parsing it directly first
  if (lastCloseIdx !== -1) {
    const fullJson = jsonCandidate.substring(0, lastCloseIdx + 1);
    try {
      return JSON.parse(fullJson);
    } catch (e) {
      // Fallback to repair if standard parse fails
      return JSON.parse(tryRepairJson(fullJson));
    }
  }

  // If no closing tag found at all (severe truncation), try repairing the whole remnant
  return JSON.parse(tryRepairJson(jsonCandidate));
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
    ? "字数要求：必须是深度长文，约800-1000字。内容要极其详实，多使用小红书式的列表排版和丰富的Emoji。" 
    : (length === 'short' ? "字数要求：150字以内。短小精悍，爆点十足。" : "字数要求：约400字。中规中矩。");

  const prompt = `
    作为顶级小红书爆款博主，请针对“${topic}”创作一篇风格为“${style}”的笔记。
    
    【核心质量标准】:
    1. 标题必须有极强的点击欲望，带表情。
    2. 正文分段明晰，每段加表情，逻辑顺滑。
    3. ${lengthStrategy}
    
    ${isTemplateMode ? `
    【封面数据提取】:
    为iOS备忘录封面生成以下3个字段：
    - main_title: 核心大标题（10字内）。
    - highlight_text: 痛点或金句（15字内）。
    - body_preview: 吸引人的内容摘要（40字内）。
    ` : ''}

    【输出要求】:
    严格返回 JSON 格式。确保 JSON 结构完整。
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      maxOutputTokens: 8192, // 极大提升 Token 上限，解决长文截断问题
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
  if (!text) throw new Error("AI未能正常生成内容，请尝试稍微缩短话题描述。");
  
  try {
    const data = parseSafeJson(text) as GeneratedPost;
    
    // Final check and sanitization
    data.title = sanitizeContent(data.title);
    if (data.cover_summary) {
      data.cover_summary.main_title = sanitizeContent(data.cover_summary.main_title);
      data.cover_summary.highlight_text = sanitizeContent(data.cover_summary.highlight_text);
      data.cover_summary.body_preview = sanitizeContent(data.cover_summary.body_preview);
    }
    
    return data;
  } catch (e) {
    console.error("Parse failure logic hit. Raw length:", text.length);
    throw new Error("由于内容篇幅极长且接口响应受限，格式出现了微小偏差。请点击‘重新生成’，通常第二次即可完美输出。");
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
      text: `Create an aesthetic Xiaohongshu cover for topic: ${topic}. Inherit the visual style and lighting from the attached reference. NO TEXT.` 
    });
  } else {
    parts.push({ 
      text: `Stunning aesthetic photography for Xiaohongshu. Topic: ${topic}, Style: ${style}. Cinematic, 3:4 aspect ratio, NO TEXT.` 
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
  
  throw new Error("封面图生成暂时遇到困难，请稍后重试。");
};

/**
 * Get viral titles (Inspiration Feature)
 */
export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  const apiKey = process.env.API_KEY || TEXT_FREE_KEY;
  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `为话题“${topic}”提供5个小红书爆款标题。直接返回 JSON 数组格式，不要有任何其他文字。`,
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
