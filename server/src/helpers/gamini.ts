import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const generateGeminiContent = async (
  prompt: string,
  model: string = "gemini-2.5-flash"
): Promise<string> => {
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });
  return response.text ?? "";
};
