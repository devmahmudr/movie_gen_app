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
  userRating?: number | null;
  publicRating?: number; // Average rating from all users
  overview?: string;
  country?: string;
  imdbRating?: number;
  runtime?: number; // Duration in minutes
  ageRating?: string; // Age restriction/certification (e.g., "PG-13", "R", "16+")
}

export interface OpenAIRecommendation {
  title: string;
  year: number;
  reason?: string;
}

