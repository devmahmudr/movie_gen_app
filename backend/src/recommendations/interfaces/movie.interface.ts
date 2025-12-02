export interface Movie {
  movieId: string;
  title: string;
  posterPath: string;
  reason?: string;
  trailerKey?: string;
  genres?: string[];
  releaseYear?: string;
  historyId?: string;
  isWatched?: boolean;
  isNotInterested?: boolean;
}

export interface OpenAIRecommendation {
  title: string;
  year: number;
  reason?: string;
}

