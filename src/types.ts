export type ContentType = 'movie' | 'series';
export type styleLikedType = 'yes' | 'neutral' | 'no';
export type ContentStatus = 'watched' | 'to_watch' | 'not_interested';
export type RecStatus = 'suggested' | 'to_watch' | 'watched' | 'dismissed';

export interface UserProfile {
  id: string;
  name?: string;
  tasteProfile?: string;
  homeViewMode?: 'grid' | 'swipe';
  createdAt: string;
}

export interface ContentItem {
  id: string;
  userId: string;
  title: string;
  type: ContentType;
  year?: string;
  genres?: string[];
  rating?: number; // 0-5
  styleLiked?: styleLikedType;
  status: ContentStatus;
  aiNotes?: string;
  posterPath?: string;
  tmdbId?: string;
  seasonsCount?: number;
  watchedSeasons?: number[]; // [1, 2, 3] etc
  createdAt: any; // ServerTimestamp
  updatedAt?: any;
}

export interface Recommendation {
  id: string;
  userId: string;
  title: string;
  type: ContentType;
  year?: string;
  reason: string;
  matchScore: number;
  status: RecStatus;
  posterPath?: string;
  tmdbId?: string;
  seasonsCount?: number;
  createdAt: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}
