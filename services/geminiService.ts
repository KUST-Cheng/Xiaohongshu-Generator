import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

/**
 * 内部助手：获取配置好的 AI 实例
 * 确保在调用前 API_KEY 已通过 process.env 注入
 */
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined" || apiKey.trim() === "") {
    throw new Error("AUTH_REQUIRED");
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

      要求：标题有冲击力，正文多用 Emoji，排版整洁。
      ${isTemplateMode ? '同时生成封面所需的主标题、副标题和正文预览。' : ''}
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
    if (error.message === "AUTH_REQUIRED") {
      throw new Error("请先点击『开始免费使用』以配置访问权限");
    }
    throw error;
  }
};

export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `针对话题“${topic}”，给出5个小红书爆款切入点，返回JSON字符串数组。`,
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

/**
 * 核心生图函数：使用 gemini-2.5-flash-image
 * 该模型支持免费配额，生图速度快，效果好
 */
export const generatePostImage = async (
  topic: string,
  style: string,
  refImageBase64?: string
): Promise<string> => {
  try {
    const ai = getClient();
    const model = "gemini-2.5-flash-image";
    
    const styleMap: Record<string, string> = {
      emotional: "电影感，柔和光影，治愈系",
      educational: "清爽干净，高质感，极简",
      promotion: "时尚大片，高饱和度，吸睛",
      rant: "真实感，强烈对比，纪实风格"
    };

    const promptText = `一张精美的小红书封面图。主题：${topic}。风格：${styleMap[style] || "aesthetic"}。3:4 比例，专业摄影，无文字。`;

    const parts: any[] = [];
    if (refImageBase64) {
      parts.push({ inlineData: { mimeType: 'image/png', data: refImageBase64 } });
      parts.push({ text: `参考这张图的构图，为话题“${topic}”生成一张全新的小红书风格封面。` });
    } else {
      parts.push({ text: promptText });
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
    throw new Error("模型未返回有效图像");
  } catch (error: any) {
    if (error.message === "AUTH_REQUIRED") {
      throw new Error("生图功能需要配置 API Key 权限");
    }
    throw error;
  }
};