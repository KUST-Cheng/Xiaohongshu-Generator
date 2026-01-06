
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

/**
 * 核心逻辑：直接使用注入的 process.env.API_KEY
 * 在调用前即时实例化，确保获取最新的授权状态
 */
export const generatePostText = async (
  topic: string,
  style: string,
  length: string,
  isTemplateMode: boolean
): Promise<GeneratedPost> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const lengthStrategy = length === 'long' 
    ? "这是一篇深度长文（约800字），需要多级副标题、详细的步骤或独到见解。" 
    : (length === 'short' ? "短小精悍，控制在200字以内，直击痛点。" : "中等篇幅，400字左右，排版精致。");

  const prompt = `
    你是一位拥有千万粉丝的小红书顶级博主，擅长捕捉社会热点、制造视觉冲突和情感共鸣。
    请围绕话题“${topic}”创作一篇风格为“${style}”的爆款笔记。
    
    【篇幅要求】
    ${lengthStrategy}
    
    【输出规范】
    1. 标题：极具吸引力，包含关键词和 Emoji，引发点击欲望。
    2. 正文：使用“呼吸感”排版，段落简短，大量使用小红书热门 Emoji。
    3. 标签：提供 5-8 个精准的流量标签。
    ${isTemplateMode ? '4. 备忘录文案：提取 main_title (标题), highlight_text (高亮金句), body_preview (简短摘要)。' : ''}
    
    必须以纯 JSON 格式返回。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 }, // 开启最大思考预算，确保高质量逻辑
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
    if (!text) throw new Error("AI 未能生成内容");
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Text Gen Error:", error);
    if (error.message?.includes("Requested entity was not found")) {
      throw new Error("AUTH_NEED_RESET");
    }
    throw error;
  }
};

export const generatePostImage = async (
  topic: string,
  style: string,
  refImageBase64?: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const styleKeywords: Record<string, string> = {
    emotional: "soft film aesthetic, moody lighting, healing vibes, high-end lifestyle",
    educational: "minimalist flatlay, clean aesthetic, product photography, bright",
    promotion: "luxury product close-up, studio lighting, commercial quality",
    rant: "authentic street photography, high contrast, realistic texture"
  };

  const parts: any[] = [];
  if (refImageBase64) {
    parts.push({
      inlineData: { mimeType: 'image/png', data: refImageBase64 }
    });
    parts.push({ text: `根据这张参考图的构图和色调，为话题“${topic}”生成一张小红书封面大片，画面中不要出现任何文字。` });
  } else {
    parts.push({ text: `A high-quality aesthetic Xiaohongshu cover image for: ${topic}. Style: ${styleKeywords[style] || "aesthetic"}. 3:4 aspect ratio, NO TEXT, ultra-high resolution.` });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "3:4",
          imageSize: "1K"
        },
        tools: [{ googleSearch: {} }] // 启用搜索以增强图像的时代感
      }
    });

    // 遍历 parts 寻找图片数据
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("未能生成图片部分");
  } catch (error: any) {
    console.error("Image Gen Error:", error);
    if (error.message?.includes("Requested entity was not found")) {
      throw new Error("AUTH_NEED_RESET");
    }
    // 降级策略
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(topic + " aesthetic")}?width=1080&height=1440&nologo=true`;
  }
};

export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `针对话题“${topic}”，提供5个更具爆发力的小红书笔记标题方向。返回 JSON 字符串数组。`,
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
