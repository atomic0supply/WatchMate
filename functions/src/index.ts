import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";
import { GoogleGenAI, Type } from "@google/genai";

setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const MODEL = "gemini-2.5-flash";

type HistoryItem = {
  title: string;
  type: "movie" | "series";
  rating?: number;
  styleLiked?: "yes" | "neutral" | "no";
};

type RecommendationCtx = {
  history: HistoryItem[];
  tasteProfile: string;
  toWatch: HistoryItem[];
  ignoredTitles?: string[];
};

function requireAuth(auth: { uid?: string } | undefined): string {
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  return auth.uid;
}

export const generateTasteProfile = onCall(
  { secrets: [GEMINI_API_KEY] },
  async (request) => {
    requireAuth(request.auth);
    const { history } = (request.data ?? {}) as { history?: HistoryItem[] };
    if (!Array.isArray(history)) {
      throw new HttpsError("invalid-argument", "history must be an array.");
    }

    const historyText = history
      .map(
        (h) =>
          `- ${h.title} (${h.type}): Rating ${h.rating ?? "n/a"}/5, Estilo gustado: ${h.styleLiked ?? "neutral"}`
      )
      .join("\n");

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
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
      });
      return { tasteProfile: response.text || "Aún no tengo suficiente información para conocer tus gustos." };
    } catch (error) {
      console.error("Gemini Taste Profile Error:", error);
      throw new HttpsError("internal", "Error generating taste profile.");
    }
  }
);

export const generateAIRecommendations = onCall(
  { secrets: [GEMINI_API_KEY] },
  async (request) => {
    requireAuth(request.auth);
    const { history, tasteProfile, toWatch, ignoredTitles = [] } =
      (request.data ?? {}) as RecommendationCtx;

    if (!Array.isArray(history) || !Array.isArray(toWatch)) {
      throw new HttpsError("invalid-argument", "history and toWatch must be arrays.");
    }

    const historyTitles = history.map((h) => h.title);
    const toWatchTitles = toWatch.map((h) => h.title);

    const prompt = `
      Eres un experto en cine y series. Basándote en el perfil de gusto del usuario y su historial, recomienda 12 obras (películas o series) que NO estén en su lista.

      Perfil de gusto:
      ${tasteProfile}

      Historial (Ya visto):
      ${historyTitles.join(", ")}

      Lista de pendientes:
      ${toWatchTitles.join(", ")}

      OBRAS A EVITAR (El usuario las ha ignorado varias veces):
      ${ignoredTitles.join(", ")}

      Reglas:
      1. Proporciona recomendaciones precisas que encajen con su estilo.
      2. Explica claramente POR QUÉ se recomienda basándote en lo que ya ha visto.
      3. Asigna un matchScore del 1 al 100.
      4. NO recomiendes nada que esté en la lista de OBRAS A EVITAR.
    `;

    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
      const response = await ai.models.generateContent({
        model: MODEL,
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
                    matchScore: { type: Type.NUMBER },
                  },
                  required: ["title", "type", "reason", "matchScore"],
                },
              },
            },
            required: ["recommendations"],
          },
        },
      });

      const data = JSON.parse(response.text || "{}");
      return { recommendations: data.recommendations ?? [] };
    } catch (error) {
      console.error("Gemini Recommendations Error:", error);
      throw new HttpsError("internal", "Error generating recommendations.");
    }
  }
);
