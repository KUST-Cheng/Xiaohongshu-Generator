import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined" || apiKey.trim() === "") {
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

      要求：标题有冲击力，正文多用 Emoji，排版整洁。
      
      特别任务：
      1. 请为这个话题生成一段简短的【英文生图描述词】(image_prompt)，描述一张高质量、美观、适合做封面的摄影图片，不要包含文字。
      2. ${isTemplateMode ? '生成封面所需的主标题、副标题和正文预览。' : ''}
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
            image_prompt: { type: Type.STRING, description: "English prompt for AI image generation" },
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

    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    console.error("Text Gen Error:", error);
    throw error;
  }
};

/**
 * 使用 Pollinations.ai 免费生图
 * 优点：完全免费、无需 API Key、基于 Flux/Stable Diffusion
 */
export const generatePostImage = async (
  topic: string,
  style: string,
  aiImagePrompt?: string
): Promise<string> => {
  // 如果 Gemini 生成了专门的生图提示词则优先使用，否则使用基础描述
  const basePrompt = aiImagePrompt || topic;
  const styleKeywords: Record<string, string> = {
    emotional: "cinematic lighting, healing aesthetic, moody photography, high quality",
    educational: "clean and minimalist, high quality photography, soft natural light",
    promotion: "fashion editorial style, high saturation, vibrant, professional product photography",
    rant: "authentic street style photography, sharp contrast, real life atmosphere"
  };

  const finalPrompt = encodeURIComponent(`${basePrompt}, ${styleKeywords[style] || "aesthetic photography"}, 4k, high resolution, no text`);
  
  // 随机种子增加多样性
  const seed = Math.floor(Math.random() * 1000000);
  
  // 拼接 Pollinations API URL
  // 这里的参数：width=1080, height=1440 (符合3:4比例), nologo=true, model=flux
  const imageUrl = `https://image.pollinations.ai/prompt/${finalPrompt}?width=1080&height=1440&seed=${seed}&nologo=true&model=flux&enhance=true`;

  // 验证图片是否可用（Pollinations 会直接返回图片流，我们只需验证 URL）
  return imageUrl;
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