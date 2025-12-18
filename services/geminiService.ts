
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

/**
 * 核心逻辑：直接使用注入的 process.env.API_KEY
 * 遵循规范：在调用前即时实例化，避免在模块顶层初始化导致变量未加载
 */
export const generatePostText = async (
  topic: string,
  style: string,
  length: string,
  isTemplateMode: boolean
): Promise<GeneratedPost> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const lengthStrategy = length === 'long' 
    ? "这是一篇深度长文（约800字），需要清晰的逻辑结构和丰富的细节。" 
    : (length === 'short' ? "短小精悍，控制在200字以内。" : "中等篇幅，400字左右。");

  const prompt = `
    你是一位精通小红书算法的爆款笔记专家。
    话题：${topic}
    风格：${style}
    篇幅：${lengthStrategy}
    
    请输出一篇极具吸引力的笔记：
    1. 标题：包含 2-3 个关键词，使用表情符号，引发好奇心。
    2. 正文：排版优雅，多用 Emoji 分隔，语感亲切。
    3. 标签：生成 5-10 个热点标签。
    ${isTemplateMode ? '4. 封面摘要：提供 main_title (主标题), highlight_text (金句), body_preview (简短摘要)。' : ''}
    
    输出必须是纯 JSON 格式。
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
    if (!text) throw new Error("EMPTY_RESPONSE");
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Gemini Text API Error:", error);
    if (error.message?.includes("API key not valid") || error.message?.includes("API key not found")) {
      throw new Error("API_KEY_INVALID");
    }
    throw error;
  }
};

export const generatePostImage = async (
  topic: string,
  style: string,
  refImageBase64?: string
): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY_MISSING");

  const ai = new GoogleGenAI({ apiKey });
  
  const styleKeywords: Record<string, string> = {
    emotional: "soft film aesthetic, healing colors, lifestyle photography",
    educational: "top view, minimalist, workspace, bright and clean",
    promotion: "product close-up, high-end commercial, 8k resolution",
    rant: "gritty street style, high contrast, authentic atmosphere"
  };

  const parts: any[] = [];
  if (refImageBase64) {
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: refImageBase64,
      },
    });
    parts.push({ text: `基于此图的艺术风格，为话题“${topic}”创作一张小红书风格的配图，不含任何文字。` });
  } else {
    parts.push({ text: `Generate an aesthetic, high-quality Xiaohongshu cover image about: ${topic}. Style: ${styleKeywords[style] || "aesthetic"}. Vertical 3:4 aspect ratio, minimalist, no text on image.` });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "3:4"
        }
      }
    });

    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (part?.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("NO_IMAGE_PART");
  } catch (error) {
    console.error("Gemini Image API Error:", error);
    // 回退方案：使用备用的免费生成接口以防万一
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(topic + ", aesthetic, xiaohongshu style")}?width=1080&height=1440&nologo=true`;
  }
};

export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  const apiKey = process.env.API_KEY;
  if (!apiKey) return [];

  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `针对话题“${topic}”，列出5个小红书爆款标题切入点。以 JSON 字符串数组形式返回。`,
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
