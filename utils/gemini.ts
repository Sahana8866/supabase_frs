
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Function to convert base64 to a generative part
const fileToGenerativePart = (base64: string, mimeType: string) => {
  // remove data:image/png;base64, prefix
  const base64Data = base64.split(',')[1];
  return {
    inlineData: {
      data: base64Data,
      mimeType
    },
  };
};

export const compareFaces = async (base64Image1: string, base64Image2: string): Promise<boolean> => {
  try {
    const imageParts = [
      fileToGenerativePart(base64Image1, "image/png"),
      fileToGenerativePart(base64Image2, "image/png"),
    ];
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [...imageParts, { text: "Are these two images of the same person? Answer with only 'YES' or 'NO'." }] },
    });
    
    const text = response.text.trim().toUpperCase();
    return text === 'YES';
  } catch (error) {
    console.error("Error comparing faces:", error);
    throw new Error("Could not verify face due to an API error.");
  }
};
