
import { GoogleGenAI, Type } from "@google/genai";

export const generateJournalContent = async (
  topic: string, 
  type: 'Business Forecast' | 'Technology Innovation', 
  format: string, 
  method: string
) => {
  // Always use {apiKey: process.env.API_KEY} for initialization
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Conduct a high-quality professional ${type} research paper in the form of a ${format} using the ${method} methodology on the following topic: "${topic}". 
               The industry context is Logistics & Supply Chain.
               Provide the response in two complete versions: English and Indonesian.
               You MUST use Google Search to find real, current data, trends, and citations for 2024-2025.
               
               IMPORTANT INSTRUCTIONS FOR TEXT QUALITY:
               - DO NOT use any markdown formatting like bold (**), headers (###), or bullet points (*) inside the JSON string values.
               - Ensure the academic tone and technical terminology are preserved.
               - Return ONLY a valid JSON object matching the schema.`,
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

  // Directly access .text property, do not call as a method
  const responseText = response.text || '';
  
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : responseText;
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("JSON Parsing Error. Raw response:", responseText);
    throw new Error("Failed to parse research data. Please try again.");
  }
};