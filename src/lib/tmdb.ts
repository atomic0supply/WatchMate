const TMDB_API_KEY = (process.env as any).VITE_TMDB_API_KEY || (import.meta as any).env.VITE_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

export interface TMDBMovie {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string;
  genre_ids: number[];
  overview: string;
  media_type: 'movie' | 'tv';
}

const GENRES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
  10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
  10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
};

export async function searchTMDB(query: string, year?: string): Promise<TMDBMovie[]> {
  if (!TMDB_API_KEY) return [];
  let url = `${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=es-ES`;
  if (year) url += `&year=${year}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.results.filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv');
  } catch (error) {
    console.error('TMDB Search Error:', error);
    return [];
  }
}

export async function getSeriesDetails(id: string): Promise<{ seasons_count: number }> {
  if (!TMDB_API_KEY) return { seasons_count: 0 };
  const url = `${BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}&language=es-ES`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return {
      seasons_count: data.number_of_seasons || 0
    };
  } catch (error) {
    console.error('TMDB Details Error:', error);
    return { seasons_count: 0 };
  }
}

export function getPosterUrl(path: string | null | undefined, size: string = 'w500') {
  if (!path) return 'https://via.placeholder.com/500x750?text=No+Poster';
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function mapGenres(ids: number[]): string[] {
  return ids.map(id => GENRES[id]).filter(Boolean);
}

export async function getDetails(id: string, type: 'movie' | 'tv') {
  if (!TMDB_API_KEY) return null;
  const url = `${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&language=es-ES`;
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error('TMDB Details Error:', error);
    return null;
  }
}
