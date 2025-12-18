import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

/**
 * 获取 AI 实例
 * 优先级：1. 环境变量 process.env.API_KEY (生产部署首选)
 */
const getClient = () => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey.trim() === "") {
    // 这个错误是抛给开发者的，提醒其在部署平台上设置环境变量
    throw new Error("DEPLOYMENT_CONFIG_ERROR: 缺少 API_KEY。请在部署平台的『环境变量』中添加名为 API_KEY 的变量。");
  }
  
  return new GoogleGenAI({ apiKey });
};

export const generatePostText = async (
  topic: string,
  style: string,
  length: string,
  isTemplateMode: boolean
): Promise<GeneratedPost> => {
  try {
    const ai = getClient();
    const prompt = `
      你是一位拥有百万粉丝的小红书爆款博主。
      请根据以下信息创作一篇极具吸引力的笔记：
      - 主题: ${topic}
      - 风格: ${style}
      - 长度: ${length}

      要求：标题有冲击力（含关键词如“建议收藏”），正文多用 Emoji，排版有呼吸感，结尾有互动。
      ${isTemplateMode ? '请同时为 iOS 备忘录风格的封面生成主标题、高亮金句和内容摘要。' : ''}
    `;

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

    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    console.error("Text Gen Error:", error);
    throw error;
  }
};

export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `根据话题“${topic}”，推荐5个适合小红书的爆款切入点。返回JSON字符串数组。`,
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

export const generatePostImage = async (
  topic: string,
  style: string,
  refImageBase64?: string
): Promise<string> => {
  try {
    const ai = getClient();
    // 使用支持免费层级的 gemini-2.5-flash-image 模型
    const model = "gemini-2.5-flash-image";
    
    const styleMap: Record<string, string> = {
      emotional: "电影质感，治愈系氛围，高级色彩",
      educational: "简约清爽，明亮高质感，职场风",
      promotion: "时尚封面，高饱和度，吸睛大片",
      rant: "真实抓拍感，冷调对比，有冲击力"
    };

    const parts: any[] = [];
    if (refImageBase64) {
      parts.push({ inlineData: { mimeType: 'image/png', data: refImageBase64 } });
      parts.push({ text: `参考该图构图，为话题“${topic}”生成一张爆款小红书封面，视觉风格：${styleMap[style] || "aesthetic"}。` });
    } else {
      parts.push({ text: `一张精美的小红书封面大片。主题：${topic}。视觉风格：${styleMap[style] || "vibrant and professional"}。3:4 比例，专业摄影，无水印文字。` });
    }

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: { imageConfig: { aspectRatio: "3:4" } }
    });

    const imageData = response.candidates?.[0]?.content?.parts.find(p => p.inlineData)?.inlineData;
    if (imageData) {
      return `data:${imageData.mimeType};base64,${imageData.data}`;
    }
    throw new Error("生图模型未返回结果，请检查 API 额度。");
  } catch (error: any) {
    console.error("Image Gen Error:", error);
    throw error;
  }
};