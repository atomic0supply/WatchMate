import { GoogleGenAI, Type } from "@google/genai";
import { ContentItem, Recommendation } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateTasteProfile(history: ContentItem[]): Promise<string> {
  const historyText = history.map(h => 
    `- ${h.title} (${h.type}): Rating ${h.rating}/5, Estilo gustado: ${h.styleLiked}`
  ).join('\n');

  const prompt = `
    Analiza el siguiente historial de películas y series de un usuario para deducir sus gustos profundos.
    
    Historial:
    ${historyText}

    Deduce:
    - Qué géneros y subgéneros le apasionan.
    - Qué tipo de atmósferas, ritmos o temáticas prefiere.
    - Qué debe evitar (aquello que ha puntuado bajo o marcado como estilo no gustado).
    
    Importante: Distingue entre la calidad de la obra (rating) y si el estilo le gusta. 
    Si algo tiene rating bajo pero estilo gustado, significa que le gusta el género pero esa obra fue mala.
    
    Devuelve un resumen en primera persona (ej: "Te gustan las historias oscuras...") muy directo y útil. Máximo 100 palabras.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Aún no tengo suficiente información para conocer tus gustos.";
  } catch (error) {
    console.error("Gemini Taste Profile Error:", error);
    return "Error al generar el perfil.";
  }
}

export async function generateAIRecommendations(
  history: ContentItem[], 
  tasteProfile: string,
  toWatch: ContentItem[],
  ignoredTitles: string[] = []
): Promise<Partial<Recommendation>[]> {
  const historyTitles = history.map(h => h.title);
  const toWatchTitles = toWatch.map(h => h.title);
  
  const prompt = `
    Eres un experto en cine y series. Basándote en el perfil de gusto del usuario y su historial, recomienda 12 obras (películas o series) que NO estén en su lista.

    Perfil de gusto:
    ${tasteProfile}

    Historial (Ya visto):
    ${historyTitles.join(', ')}

    Lista de pendientes:
    ${toWatchTitles.join(', ')}

    OBRAS A EVITAR (El usuario las ha ignorado varias veces):
    ${ignoredTitles.join(', ')}

    Reglas:
    1. Proporciona recomendaciones precisas que encajen con su estilo.
    2. Explica claramente POR QUÉ se recomienda basándote en lo que ya ha visto.
    3. Asigna un matchScore del 1 al 100.
    4. NO recomiendes nada que esté en la lista de OBRAS A EVITAR.
    5. Devuelve un JSON con este formato:
    {
      "recommendations": [
        {
          "title": "Título",
          "type": "movie" | "series",
          "year": "YYYY",
          "reason": "Explicación breve",
          "matchScore": 95
        }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  type: { type: Type.STRING },
                  year: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  matchScore: { type: Type.NUMBER }
                },
                required: ["title", "type", "reason", "matchScore"]
              }
            }
          },
          required: ["recommendations"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return data.recommendations || [];
  } catch (error) {
    console.error("Gemini Recommendations Error:", error);
    return [];
  }
}
