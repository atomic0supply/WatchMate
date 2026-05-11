import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';
import { ContentItem, Recommendation } from '../types';

const functions = getFunctions(app, 'us-central1');

const tasteProfileFn = httpsCallable<
  { history: Partial<ContentItem>[] },
  { tasteProfile: string }
>(functions, 'generateTasteProfile');

const recommendationsFn = httpsCallable<
  {
    history: Partial<ContentItem>[];
    tasteProfile: string;
    toWatch: Partial<ContentItem>[];
    ignoredTitles: string[];
  },
  { recommendations: Partial<Recommendation>[] }
>(functions, 'generateAIRecommendations');

function slim(item: ContentItem) {
  return {
    title: item.title,
    type: item.type,
    rating: item.rating,
    styleLiked: item.styleLiked,
  };
}

export async function generateTasteProfile(history: ContentItem[]): Promise<string> {
  try {
    const { data } = await tasteProfileFn({ history: history.map(slim) });
    return data.tasteProfile;
  } catch (error) {
    console.error('Taste profile call failed:', error);
    return 'Error al generar el perfil.';
  }
}

export async function generateAIRecommendations(
  history: ContentItem[],
  tasteProfile: string,
  toWatch: ContentItem[],
  ignoredTitles: string[] = []
): Promise<Partial<Recommendation>[]> {
  try {
    const { data } = await recommendationsFn({
      history: history.map(slim),
      tasteProfile,
      toWatch: toWatch.map(slim),
      ignoredTitles,
    });
    return data.recommendations ?? [];
  } catch (error) {
    console.error('Recommendations call failed:', error);
    return [];
  }
}
