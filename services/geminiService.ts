import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

/**
 * 获取 AI 实例
 * 优先级：
 * 1. 环境变量 process.env.API_KEY (生产部署最佳实践)
 * 2. 硬编码回退 (用户提供的 Key)
 */
const getClient = () => {
  const apiKey = process.env.API_KEY || "AIzaSyA6KBntpKfjGV9t0kkNEqKYDVUB4oPj4lE";
  
  if (!apiKey || apiKey === "undefined" || apiKey.trim() === "") {
    throw new Error("API_KEY_NOT_FOUND");
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

export const generatePostImage = async (
  topic: string,
  style: string,
  refImageBase64?: string
): Promise<string> => {
  try {
    const ai = getClient();
    // 使用核心模型名称，避免触发预览版配额限制
    const model = "gemini-2.5-flash-image";
    
    const styleMap: Record<string, string> = {
      emotional: "电影感，治愈系",
      educational: "清爽干净，高质感",
      promotion: "时尚大片，高饱和度",
      rant: "真实感，冲击力"
    };

    const promptText = `一张精美的小红书封面图。主题：${topic}。风格：${styleMap[style] || "aesthetic"}。3:4 比例，专业摄影，无文字。`;

    const parts: any[] = [];
    if (refImageBase64) {
      parts.push({ inlineData: { mimeType: 'image/png', data: refImageBase64 } });
      parts.push({ text: `参考构图生成话题“${topic}”的新封面。` });
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
    throw new Error("IMAGE_GEN_FAILED");
  } catch (error: any) {
    // 捕获配额错误并重新抛出，以便 UI 层处理
    if (error.message?.includes("429") || error.message?.includes("quota") || error.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("QUOTA_EXCEEDED");
    }
    throw error;
  }
};