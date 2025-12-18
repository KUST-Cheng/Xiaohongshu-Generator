
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

/**
 * 动态创建 AI 实例
 * 遵循规范：不预先检查，在调用时由平台注入 process.env.API_KEY
 */
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  // 如果此时没有 Key，后面 API 调用会抛出 401/403，由 App.tsx 捕获并引导授权
  return new GoogleGenAI({ apiKey: apiKey || "" });
};

export const generatePostText = async (
  topic: string,
  style: string,
  length: string,
  isTemplateMode: boolean
): Promise<GeneratedPost> => {
  try {
    const ai = getAiClient();
    
    // 逻辑优化：长文案使用 Pro 模型以获得极高的逻辑连贯性
    const isLong = length === 'long';
    const model = isLong ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    
    // 结构化长文案 Prompt
    const lengthStrategy = isLong 
      ? `这是一篇深度长笔记（800-1000字）。请遵循：
         1. 钩子开头：3秒内抓住注意力；
         2. 结构化主体：使用3-5个带Emoji的【副标题】划分段落，每段提供实质性建议或故事；
         3. 情绪收尾：升华主题，引发共鸣；
         4. 互动提问：设计一个必回的评论区话题。`
      : (length === 'short' ? "短小精悍，200字内。" : "标准篇幅，400字左右，排版美观。");

    const prompt = `
      你是一位拥有百万粉丝的小红书顶级爆款博主。
      话题: ${topic}
      风格: ${style}
      篇幅策略: ${lengthStrategy}

      要求：
      - 正文多用 Emoji，段落短小，有呼吸感。
      - 生成 5-8 个精准的高流量标签。
      ${isTemplateMode ? '- 同时提取封面摘要：main_title (主标题), highlight_text (高亮金句), body_preview (正文摘要)。' : ''}
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        // 为 Pro 模型开启 Thinking Budget，确保长内容逻辑连贯
        ...(isLong ? { thinkingConfig: { thinkingBudget: 4000 } } : {}),
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

    const result = response.text;
    if (!result) throw new Error("EMPTY_RESPONSE");
    return JSON.parse(result);
  } catch (error: any) {
    console.error("Text Gen Error:", error);
    const msg = error.message || "";
    // 识别授权错误或 Key 缺失
    if (msg.includes("403") || msg.includes("401") || msg.includes("API key") || msg.includes("not found")) {
      throw new Error("AUTH_REQUIRED");
    }
    throw error;
  }
};

export const generatePostImage = async (
  topic: string,
  style: string,
  refImageBase64?: string
): Promise<string> => {
  try {
    const ai = getAiClient();
    const styleKeywords: Record<string, string> = {
      emotional: "soft natural lighting, cinematic photography, high-end healing vibe",
      educational: "minimalist, clean workspace, high quality product design",
      promotion: "commercial photography, vibrant, luxury brand style",
      rant: "authentic street style, dramatic shadows, impactful"
    };

    const parts: any[] = [];
    if (refImageBase64) {
      parts.push({ inlineData: { mimeType: 'image/png', data: refImageBase64 } });
      parts.push({ text: `基于该图构图，为话题"${topic}"生成一张风格为${styleKeywords[style] || "aesthetic"}的小红书封面。` });
    } else {
      parts.push({ text: `High quality aesthetic Xiaohongshu cover for: ${topic}. Style: ${styleKeywords[style] || "vibrant"}. 3:4 ratio, no text.` });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts },
      config: { imageConfig: { aspectRatio: "3:4" } }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("IMAGE_FAILED");
  } catch (error) {
    console.warn("Image gen failed, using fallback:", error);
    const seed = Math.floor(Math.random() * 10000);
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(topic + ", aesthetic style, 4k")}?width=1080&height=1440&seed=${seed}&nologo=true`;
  }
};

export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `话题“${topic}”的5个爆款切入点。JSON数组。`,
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
