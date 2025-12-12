/**
 * Recommendation Service Configuration Constants
 */
export const RECOMMENDATION_CONFIG = {
  MAX_ATTEMPTS: 3,
  MOVIES_NEEDED: 3,
  BACKUP_COUNT: 2,
  RETRY_DELAY_MS: 1000,
  PARALLEL_PROCESSING_LIMIT: 10,
  CACHE_TTL: {
    MOVIE_DETAILS: 7 * 24 * 60 * 60, // 7 days in seconds
    MOVIE_TITLES: 7 * 24 * 60 * 60, // 7 days
    TRAILERS: 30 * 24 * 60 * 60, // 30 days
    RECOMMENDATIONS: 60 * 60, // 1 hour
  },
  RATE_LIMIT: {
    MAX_REQUESTS: 10,
    WINDOW_MS: 60 * 1000, // 1 minute
  },
  CIRCUIT_BREAKER: {
    ERROR_THRESHOLD: 5,
    TIMEOUT_MS: 30 * 1000, // 30 seconds
    RESET_TIMEOUT_MS: 60 * 1000, // 1 minute
  },
  RETRY: {
    MAX_RETRIES: 3,
    INITIAL_DELAY_MS: 1000,
    MAX_DELAY_MS: 10000,
    BACKOFF_MULTIPLIER: 2,
  },
  TIMEOUT: {
    TMDB_SEARCH: 5000, // 5 seconds
    TMDB_DETAILS: 5000,
    OPENAI: 30000, // 30 seconds
    YOUTUBE: 5000,
    OMDB: 3000,
  },
  HISTORY_LIMIT: 50, // Limit AVOID list to last 50 movies
} as const;

