import { GoogleGenAI, Schema, Type } from "@google/genai";
import { GeneratedPost } from "../types";

// Define the response schema for structured JSON output
const postSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "The main title of the post, catchy and viral." },
    content: { type: Type.STRING, description: "The main body content of the post, formatted with line breaks." },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "A list of relevant hashtags."
    },
    cover_summary: {
      type: Type.OBJECT,
      properties: {
        main_title: { type: Type.STRING },
        highlight_text: { type: Type.STRING },
        body_preview: { type: Type.STRING }
      },
      description: "Summary text specifically for the iOS memo cover template.",
      nullable: true
    }
  },
  required: ["title", "content", "tags"]
};

/**
 * Helper to get a fresh AI instance
 */
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generatePostText = async (
  topic: string,
  style: string,
  length: string,
  isTemplateMode: boolean
): Promise<GeneratedPost> => {
  const ai = getAI();
  const prompt = `
    You are a professional Xiaohongshu (Red Note) content creator with 1M+ followers.
    Create a viral post based on the following inputs:
    - Topic: ${topic}
    - Style: ${style}
    - Length: ${length}

    Guidelines:
    1. Use emojis liberally (Xiaohongshu style).
    2. The title must be catchy (clickbait but honest).
    3. The tone must match the requested style.
    4. Format the content with clear paragraphs.
    ${isTemplateMode ? '5. Also generate specific short text for an "iOS Memo" style cover image.' : ''}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: postSchema,
        temperature: 0.8, 
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as GeneratedPost;
    }
    throw new Error("Empty response from AI");
  } catch (error) {
    console.error("Text Gen Error:", error);
    throw error;
  }
};

export const generateRelatedTopics = async (topic: string): Promise<string[]> => {
  if (!topic) return [];
  const ai = getAI();

  const prompt = `
    Based on the topic "${topic}", suggest 5 viral, catchy, and related sub-topics for Xiaohongshu (Red Note).
    The suggestions should be distinct angles or hooks related to the main topic.
    Keep them short (under 10 words).
    Return ONLY a JSON array of strings. Example: ["30岁裸辞", "大理民宿避雷", "一人食记"]
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
           type: Type.ARRAY,
           items: { type: Type.STRING }
        }
      }
    });
    if (response.text) {
      return JSON.parse(response.text);
    }
    return [];
  } catch (e) {
    console.error("Related Topics Error:", e);
    return [];
  }
};

export const generatePostImage = async (
  topic: string,
  style: string,
  refImageBase64?: string
): Promise<string> => {
  const ai = getAI();

  const stylePrompts: Record<string, string> = {
    emotional: "warm lighting, cozy atmosphere, soft focus, film grain, aesthetic",
    educational: "clean background, minimalistic, bright lighting, organized, high definition",
    promotion: "vibrant colors, product focus, trendy, fashion magazine style, high contrast",
    rant: "dramatic lighting, moody, expressive, bold composition, street photography style"
  };

  const basePrompt = `
    Create a high-quality, viral social media cover image for Xiaohongshu (Red Note).
    Topic: ${topic}.
    Style description: ${stylePrompts[style] || "aesthetic, trendy"}.
    Aspect ratio: Vertical (3:4).
    Requirements: Photorealistic, no text overlays, high detail, 4k resolution.
  `;

  try {
    let response;

    if (refImageBase64) {
      const imagePart = {
        inlineData: {
          mimeType: 'image/png',
          data: refImageBase64
        }
      };
      
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            imagePart,
            { text: basePrompt + " Create a variation of this image that matches the topic better while keeping the composition." }
          ]
        }
      });
    } else {
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: basePrompt }]
        }
      });
    }

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    
    throw new Error("No image generated");

  } catch (error) {
    console.error("Image Gen Error:", error);
    throw error;
  }
};