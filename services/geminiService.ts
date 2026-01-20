
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateJournalContent = async (
  topic: string, 
  type: 'Business Forecast' | 'Technology Innovation', 
  format: string, 
  method: string
) => {
  // Menggunakan gemini-3-pro-preview untuk tugas kompleks dengan search grounding
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Conduct a high-quality professional ${type} research paper in the form of a ${format} using the ${method} methodology on the following topic: "${topic}". 
               The industry context is Logistics & Supply Chain.
               Provide the response in two complete versions: English and Indonesian.
               You MUST use Google Search to find real, current data, trends, and citations for 2024-2025.
               Ensure the academic tone and technical terminology are preserved in both versions.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          english: {
            type: Type.OBJECT,
            properties: {
              abstract: { type: Type.STRING },
              introduction: { type: Type.STRING },
              methodology: { type: Type.STRING },
              results: { type: Type.STRING },
              conclusion: { type: Type.STRING },
              references: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["abstract", "introduction", "methodology", "results", "conclusion", "references"]
          },
          indonesian: {
            type: Type.OBJECT,
            properties: {
              abstract: { type: Type.STRING },
              introduction: { type: Type.STRING },
              methodology: { type: Type.STRING },
              results: { type: Type.STRING },
              conclusion: { type: Type.STRING },
              references: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["abstract", "introduction", "methodology", "results", "conclusion", "references"]
          }
        },
        required: ["english", "indonesian"]
      }
    }
  });

  // Ekstrak hasil grounding jika ada (untuk ditampilkan di UI jika perlu)
  const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  console.log("Research Grounding Sources:", grounding);

  return JSON.parse(response.text);
};
