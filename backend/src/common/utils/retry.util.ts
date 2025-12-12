import { RECOMMENDATION_CONFIG } from '../../recommendations/constants/recommendation.config';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryable?: (error: any) => boolean;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = RECOMMENDATION_CONFIG.RETRY.MAX_RETRIES,
    initialDelayMs = RECOMMENDATION_CONFIG.RETRY.INITIAL_DELAY_MS,
    maxDelayMs = RECOMMENDATION_CONFIG.RETRY.MAX_DELAY_MS,
    backoffMultiplier = RECOMMENDATION_CONFIG.RETRY.BACKOFF_MULTIPLIER,
    retryable = (error) => {
      // Retry on network errors, timeouts, and 5xx errors
      return (
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNABORTED' ||
        (error.response && error.response.status >= 500) ||
        (error.response && error.response.status === 429)
      );
    },
  } = options;

  let lastError: any;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !retryable(error)) {
        throw error;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}

