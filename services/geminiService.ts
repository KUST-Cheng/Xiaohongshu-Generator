
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

/**
 * 按照规范，在每次调用前即时实例化 GoogleGenAI。
 * 环境变量 API_KEY 必须在部署环境（如 Vercel Dashboard）中配置。
 */
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

export const generatePostText = async (
  topic: string,
  style: string,
  length: string,
  isTemplateMode: boolean
): Promise<GeneratedPost> => {
  const ai = getAiClient();
  
  const lengthStrategy = length === 'long' 
    ? "这是一篇深度长文（约800字），需要清晰的逻辑结构、丰富的细节和多级副标题。" 
    : (length === 'short' ? "短小精悍，控制在200字以内，重点突出。" : "中等篇幅，400字左右，排版舒适。");

  const prompt = `
    你是一位拥有千万粉丝的小红书爆款博主。
    针对话题“${topic}”，创作一篇风格为“${style}”的爆款笔记。
    
    【篇幅策略】
    ${lengthStrategy}
    
    【输出指南】
    1. 标题：极具吸引力，带 Emoji。
    2. 正文：排版有呼吸感，多用小红书热门表情。
    3. 标签：5-8个流量标签。
    ${isTemplateMode ? '4. 封面文案：提取 main_title (标题), highlight_text (金句), body_preview (摘要)。' : ''}
    
    必须以 JSON 格式返回。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 24576 },
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
    if (!text) throw new Error("AI 未返回内容");
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Text Gen Error:", error);
    if (error.message === "API_KEY_MISSING") throw error;
    throw new Error("生成文案失败，请稍后重试");
  }
};

export const generatePostImage = async (
  topic: string,
  style: string,
  refImageBase64?: string
): Promise<string> => {
  const ai = getAiClient();
  
  const styleKeywords: Record<string, string> = {
    emotional: "healing, soft lighting, aesthetic lifestyle, cinematic",
    educational: "clean minimal setup, workspace, organized, bright",
    promotion: "luxury product shot, high-end studio lighting",
    rant: "realistic street photography, moody, high contrast"
  };

  const parts: any[] = [];
  if (refImageBase64) {
    parts.push({ inlineData: { mimeType: 'image/png', data: refImageBase64 } });
    parts.push({ text: `根据参考图生成话题“${topic}”的小红书封面大片，画面禁止出现任何文字。` });
  } else {
    parts.push({ text: `Professional aesthetic cover for: ${topic}. Style: ${styleKeywords[style] || "aesthetic"}. NO TEXT, 3:4.` });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', // 切换到 Flash 图像模型以避开浏览器的用户 Key 授权强制要求
      contents: { parts },
      config: {
        imageConfig: { aspectRatio: "3:4" }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Image missing in response");
  } catch (error: any) {
    console.error("Image Gen Error:", error);
    // 降级方案
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(topic + " style aesthetic")}?width=1080&height=1440&nologo=true`;
  }
};

export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `针对“${topic}”提供5个爆款标题方向。JSON数组。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (e) {
    return [];
  }
};
