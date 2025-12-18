import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

/**
 * 安全地获取 AI 实例
 * 每次调用都会创建新实例，确保使用最新的 API Key 环境
 */
const getClient = () => {
  const apiKey = process.env.API_KEY;
  
  // 检查密钥是否存在且非占位符
  if (!apiKey || apiKey === "undefined" || apiKey.trim() === "" || apiKey === "YOUR_API_KEY") {
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
  try {
    const ai = getClient();
    const prompt = `
      你是一位拥有百万粉丝的小红书爆款博主。
      请根据以下信息创作一篇极具吸引力的笔记：
      - 主题: ${topic}
      - 风格: ${style}
      - 长度: ${length}

      要求：
      1. 标题必须有冲击力（使用“震惊体”、“数字体”或“悬念体”）。
      2. 正文分段清晰，大量使用 Emoji，语气亲切或犀利（取决于风格）。
      3. 结尾包含相关的互动问题。
      4. 生成 3-5 个热门标签。
      
      特别任务：
      1. 为这个话题生成一段简短的【英文生图描述词】(image_prompt)，描述一张高质量、美观、适合做封面的摄影图片，不要包含任何文字，风格要符合“${style}”。
      2. ${isTemplateMode ? '提取封面所需的信息：main_title (主标题), highlight_text (高亮金句), body_preview (简短正文预览)。' : 'cover_summary 设为 null。'}
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
            image_prompt: { type: Type.STRING },
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
          required: ["title", "content", "tags", "image_prompt"]
        }
      },
    });

    const text = response.text;
    if (!text) throw new Error("EMPTY_RESPONSE");
    
    try {
      return JSON.parse(text);
    } catch (parseErr) {
      console.error("JSON Parse Error:", text);
      throw new Error("INVALID_JSON_RESPONSE");
    }
  } catch (error: any) {
    console.error("Text Gen Error Detailed:", error);
    
    // 处理特定 API 错误
    const errorMessage = error.message || "";
    if (errorMessage.includes("401") || errorMessage.includes("403") || errorMessage.includes("invalid")) {
      throw new Error("INVALID_API_KEY");
    }
    if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("QUOTA_EXCEEDED");
    }
    if (errorMessage.includes("Requested entity was not found")) {
      throw new Error("API_KEY_NOT_FOUND");
    }
    
    throw error;
  }
};

/**
 * 使用 Pollinations.ai 免费生图
 * 核心：Gemini 负责写 Prompt，Pollinations 负责画图
 */
export const generatePostImage = async (
  topic: string,
  style: string,
  aiImagePrompt?: string
): Promise<string> => {
  const basePrompt = aiImagePrompt || topic;
  const styleKeywords: Record<string, string> = {
    emotional: "cinematic, healing, moody, high quality photography",
    educational: "minimalist, clean, bright, professional workspace",
    promotion: "luxurious, high-end product photography, vibrant, trendy",
    rant: "urban, gritty, realistic, sharp contrast"
  };

  const finalPrompt = encodeURIComponent(`${basePrompt}, ${styleKeywords[style] || "aesthetic photography"}, 4k, no text, masterpiece`);
  const seed = Math.floor(Math.random() * 1000000);
  
  // 使用 Pollinations.ai 的图片 API，不需要 Key
  return `https://image.pollinations.ai/prompt/${finalPrompt}?width=1080&height=1440&seed=${seed}&nologo=true&model=flux&enhance=true`;
};

export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `针对话题“${topic}”，给出5个小红书爆款笔记的标题切入点。以 JSON 字符串数组形式返回。`,
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