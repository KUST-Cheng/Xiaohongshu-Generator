
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

/**
 * 按照规范，在每次调用前即时实例化 GoogleGenAI。
 */
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    // 抛出特定错误，以便 App.tsx 捕获并引导用户进行 Key 关联
    throw new Error("API_KEY_MISSING");
  }
  
  // 修复：删除不支持的 baseUrl 属性。GoogleGenAI 构造函数仅接受带有 apiKey 的对象。
  return new GoogleGenAI({ 
    apiKey
  });
};

export const generatePostText = async (
  topic: string,
  style: string,
  length: string,
  isTemplateMode: boolean
): Promise<GeneratedPost> => {
  const ai = getAiClient();
  
  const lengthStrategy = length === 'long' 
    ? "这是一篇深度长文（约800字），需要清晰的逻辑结构、丰富的细节 and 多级副标题。" 
    : (length === 'short' ? "短小精悍，控制在200字以内，重点突出。" : "中等篇幅，400字左右，排版舒适。");

  const prompt = `
    你是一位拥有千万粉丝的小红书爆款博主。针对话题“${topic}”，创作一篇风格为“${style}”的爆款笔记。
    【创作要求】: 标题带 Emoji，正文有呼吸感，多用表情，结尾带 5-8 个标签。
    【篇幅策略】: ${lengthStrategy}
    必须以纯 JSON 格式返回。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
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
    if (!text) throw new Error("AI 返回结果为空");
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Text Gen Error:", error);
    throw error;
  }
};

export const generatePostImage = async (
  topic: string,
  style: string,
  refImageBase64?: string
): Promise<string> => {
  const ai = getAiClient();
  
  const parts: any[] = [];
  if (refImageBase64) {
    parts.push({ inlineData: { mimeType: 'image/png', data: refImageBase64 } });
    parts.push({ text: `参考此图风格，为话题“${topic}”生成一张小红书高审美封面大片，画面禁止出现文字。` });
  } else {
    parts.push({ text: `Professional aesthetic cover for: ${topic}. Style: ${style}. NO TEXT, 3:4 aspect ratio.` });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview', // 使用旗舰图像模型
      contents: { parts },
      config: {
        imageConfig: { 
          aspectRatio: "3:4",
          imageSize: "1K" // 确保 1K 分辨率
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      // Find the image part, do not assume it is the first part.
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("图像生成未返回有效数据");
  } catch (error: any) {
    console.error("Image Gen Error:", error);
    // 降级方案
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(topic + " aesthetic")}?width=1080&height=1440&nologo=true`;
  }
};

export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `针对话题“${topic}”给出5个更具爆发力的标题方向。JSON数组。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    // Use .text property directly
    return JSON.parse(response.text || "[]");
  } catch (e) {
    return [];
  }
};
