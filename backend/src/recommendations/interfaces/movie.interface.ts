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
  overview?: string;
  country?: string;
  imdbRating?: number;
}

export interface OpenAIRecommendation {
  title: string;
  year: number;
  reason?: string;
}

