
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedPost } from "../types";

/**
 * 按照规范，在每次调用前即时实例化 GoogleGenAI。
 * 去除了 SDK 不支持的 baseUrl 属性。
 */
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  return new GoogleGenAI({ 
    apiKey: apiKey
  });
};

export const generatePostText = async (
  topic: string,
  style: string,
  length: string,
  isTemplateMode: boolean
): Promise<GeneratedPost> => {
  // 每次调用前实例化，确保获取最新 API Key
  const ai = getAiClient();
  
  const lengthStrategy = length === 'long' 
    ? "这是一篇深度长文（约800字），需要清晰的逻辑结构、丰富的细节和多级副标题。" 
    : (length === 'short' ? "短小精悍，控制在200字以内，重点突出。" : "中等篇幅，400字左右，排版舒适。");

  const prompt = `
    你是一位拥有千万粉丝的小红书爆款博主，擅长捕捉流量密码。
    针对话题“${topic}”，创作一篇风格为“${style}”的爆款笔记。
    
    【创作要求】
    1. 标题：必须包含 2-3 个关键词，使用吸引人的表情符号，制造好奇感或利他感。
    2. 正文：排版必须有“呼吸感”，每段话简短，多用 Emoji 装饰。
    3. 标签：生成 5-10 个热点搜索标签。
    ${isTemplateMode ? '4. 封面提取：生成 main_title (封面主标题), highlight_text (金句), body_preview (摘要)。' : ''}
    
    【篇幅策略】
    ${lengthStrategy}

    请严格输出纯 JSON 格式，不要包含任何 Markdown 代码块。
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
              }
            }
          },
          propertyOrdering: ["title", "content", "tags", "cover_summary"]
        }
      },
    });

    // 使用 .text 属性直接获取文本内容
    const text = response.text;
    if (!text) throw new Error("AI 返回内容为空");
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Text Gen Error:", error);
    if (error.message === "API_KEY_MISSING") throw new Error("API 密钥未注入，请检查 Vercel 环境变量设置");
    throw new Error("文案生成失败: " + (error.message || "请检查网络连接"));
  }
};

export const generatePostImage = async (
  topic: string,
  style: string,
  refImageBase64?: string
): Promise<string> => {
  const ai = getAiClient();
  
  const styleKeywords: Record<string, string> = {
    emotional: "healing aesthetic, soft lighting, cinematic, 4k lifestyle photography",
    educational: "minimalist flatlay, desk setup, clean workspace, high-end design",
    promotion: "premium product photography, studio lighting, luxury magazine style",
    rant: "authentic street style photography, moody contrast, raw texture"
  };

  const parts: any[] = [];
  if (refImageBase64) {
    parts.push({ inlineData: { mimeType: 'image/png', data: refImageBase64 } });
    parts.push({ text: `参考此图的构图和色调，为“${topic}”生成一张小红书高审美封面大片。画面中严禁出现任何文字或字母，保持纯净。` });
  } else {
    parts.push({ text: `Professional aesthetic cover for Xiaohongshu topic: ${topic}. Style: ${styleKeywords[style] || "aesthetic"}. NO TEXT, NO LOGO, 3:4 aspect ratio, ultra high quality.` });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: {
        imageConfig: { 
          aspectRatio: "3:4",
          imageSize: "1K"
        }
      }
    });

    // 迭代所有 parts 以找到包含图像数据的 part
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("图片生成未返回数据");
  } catch (error: any) {
    console.error("Image Gen Error:", error);
    // 降级方案
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(topic + ", aesthetic rednote style, 3:4")}?width=1080&height=1440&nologo=true`;
  }
};

export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `针对话题“${topic}”，给出5个更有点击潜力的差异化笔记标题。以 JSON 字符串数组格式返回。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    // 使用 .text 属性直接获取文本内容
    return JSON.parse(response.text || "[]");
  } catch (e) {
    return [];
  }
};
