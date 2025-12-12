/**
 * Enhanced TMDb Search Improvements
 * 
 * This file contains utility functions to improve movie search reliability
 * and ensure we always find matching movies in TMDb database.
 */

import axios from 'axios';

/**
 * Normalize movie title for comparison
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\b(the|a|an)\b/g, '') // Remove articles
    .trim()
    .replace(/\s+/g, ' '); // Normalize spaces
}

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  const len1 = str1.length;
  const len2 = str2.length;

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity between two titles (0-1 scale)
 */
export function calculateTitleSimilarity(title1: string, title2: string): number {
  const normalized1 = normalizeTitle(title1);
  const normalized2 = normalizeTitle(title2);

  // Exact match
  if (normalized1 === normalized2) return 1.0;

  // Levenshtein distance
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);
  const similarity = 1 - (distance / maxLength);

  return similarity;
}

/**
 * Calculate overall match score between requested and found movie
 */
export function calculateMatchScore(
  requestedTitle: string,
  requestedYear: number | undefined,
  foundTitle: string,
  foundYear: string | undefined
): number {
  let score = 0;

  // Title similarity (70% weight)
  const titleSim = calculateTitleSimilarity(requestedTitle, foundTitle);
  score += titleSim * 0.7;

  // Year match (30% weight)
  if (requestedYear && foundYear) {
    const foundYearNum = parseInt(foundYear);
    const yearDiff = Math.abs(requestedYear - foundYearNum);
    if (yearDiff === 0) {
      score += 0.3; // Perfect match
    } else if (yearDiff === 1) {
      score += 0.2; // Close match
    } else if (yearDiff <= 2) {
      score += 0.1; // Acceptable match
    }
    // yearDiff > 2: no points
  } else {
    score += 0.15; // No year to compare, give partial credit
  }

  return score;
}

/**
 * Generate alternative search titles
 */
export function generateSearchVariations(title: string): string[] {
  const variations: string[] = [title];

  // Remove articles
  const withoutArticles = title.replace(/^(the|a|an)\s+/i, '');
  if (withoutArticles !== title) {
    variations.push(withoutArticles);
  }

  // Remove colons and special characters
  const withoutColon = title.replace(/:\s*/g, ' ');
  if (withoutColon !== title) {
    variations.push(withoutColon);
  }

  // Remove parentheses content (e.g., "Movie (2023)" -> "Movie")
  const withoutParentheses = title.replace(/\s*\([^)]*\)\s*/g, '').trim();
  if (withoutParentheses !== title && withoutParentheses.length > 0) {
    variations.push(withoutParentheses);
  }

  // Remove "Part X" or "Chapter X"
  const withoutPart = title.replace(/\s+(part|chapter)\s+\d+/i, '').trim();
  if (withoutPart !== title && withoutPart.length > 0) {
    variations.push(withoutPart);
  }

  return [...new Set(variations)]; // Remove duplicates
}

/**
 * Search movie with multiple fallback strategies
 */
export async function searchMovieWithFallbacks(
  title: string,
  year: number | undefined,
  language: string,
  apiKey: string,
  baseUrl: string,
  searchFn: (title: string, year?: number, lang?: string) => Promise<any>
): Promise<any> {
  // Strategy 1: Exact title + year
  let result = await searchFn(title, year, language);
  if (result) return result;

  // Strategy 2: Title without year
  if (year) {
    result = await searchFn(title, undefined, language);
    if (result) return result;
  }

  // Strategy 3: Try title variations
  const variations = generateSearchVariations(title);
  for (const variation of variations) {
    if (variation === title) continue; // Already tried
    
    result = await searchFn(variation, year, language);
    if (result) {
      // Validate similarity
      const similarity = calculateTitleSimilarity(title, result.title);
      if (similarity > 0.7) {
        return result;
      }
    }
  }

  // Strategy 4: Try English if searching in Russian
  if (language.startsWith('ru')) {
    result = await searchFn(title, year, 'en-US');
    if (result) {
      const similarity = calculateTitleSimilarity(title, result.title);
      if (similarity > 0.7) {
        return result;
      }
    }
  }

  // Strategy 5: Try without year + variations
  if (year) {
    for (const variation of variations) {
      if (variation === title) continue;
      result = await searchFn(variation, undefined, language);
      if (result) {
        const similarity = calculateTitleSimilarity(title, result.title);
        if (similarity > 0.65) { // Lower threshold for variation
          return result;
        }
      }
    }
  }

  return null;
}

/**
 * Search multiple results and return best match
 */
export async function searchMovieMultiple(
  title: string,
  year: number | undefined,
  language: string,
  apiKey: string,
  baseUrl: string
): Promise<Array<{ movie: any; score: number }>> {
  const searchUrl = `${baseUrl}/search/movie`;
  const params: any = {
    api_key: apiKey,
    query: title,
    language: language,
    page: 1,
  };

  if (year) {
    params.year = year;
  }

  try {
    const response = await axios.get(searchUrl, { params, timeout: 5000 });

    if (!response.data?.results || response.data.results.length === 0) {
      return [];
    }

    // Score each result
    const scoredResults = response.data.results.slice(0, 10).map((movie: any) => {
      const score = calculateMatchScore(
        title,
        year,
        movie.title,
        movie.release_date ? movie.release_date.split('-')[0] : undefined
      );
      return { movie, score };
    });

    // Sort by score (highest first)
    return scoredResults.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error(`[TMDb] Search error for "${title}":`, error.message);
    return [];
  }
}

/**
 * Get fallback recommendations using TMDb Discover API
 */
export async function getFallbackRecommendations(
  genreIds: number[],
  year: number | undefined,
  excludeIds: string[],
  language: string,
  apiKey: string,
  baseUrl: string,
  limit: number = 10
): Promise<any[]> {
  const discoverUrl = `${baseUrl}/discover/movie`;
  const params: any = {
    api_key: apiKey,
    with_genres: genreIds.join(','),
    sort_by: 'popularity.desc',
    page: 1,
    language: language,
    'vote_count.gte': 100, // Only movies with at least 100 votes (more reliable)
    'vote_average.gte': 6.0, // Only movies with rating >= 6.0
  };

  if (year) {
    params.year = year;
  }

  try {
    const response = await axios.get(discoverUrl, { params, timeout: 5000 });

    if (!response.data?.results || response.data.results.length === 0) {
      return [];
    }

    // Filter out excluded movies and remove duplicates by movieId
    const seenMovieIds = new Set<string>();
    const uniqueMovies = response.data.results
      .filter((movie: any) => {
        const movieId = movie.id.toString();
        // Filter out excluded movies and duplicates
        if (excludeIds.includes(movieId) || seenMovieIds.has(movieId)) {
          return false;
        }
        seenMovieIds.add(movieId);
        return true;
      })
      .slice(0, limit);

    return uniqueMovies.map((movie: any) => ({
      movieId: movie.id.toString(),
      title: movie.title,
      posterPath: movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : '',
      releaseYear: movie.release_date ? movie.release_date.split('-')[0] : '',
      overview: movie.overview,
    }));
  } catch (error) {
    console.error('[TMDb] Discover API error:', error.message);
    return [];
  }
}

/**
 * Map genre names and tags to TMDb genre IDs
 * Handles both direct genre names and emoji-based tags
 */
export function mapGenresToTMDbIds(genres: string[]): number[] {
  // TMDb genre mapping (common genres)
  const genreMap: { [key: string]: number } = {
    // Direct genre names
    'боевик': 28,      // Action
    'комедия': 35,     // Comedy
    'криминал': 80,    // Crime
    'драма': 18,       // Drama
    'ужасы': 27,       // Horror
    'фантастика': 878, // Science Fiction
    'триллер': 53,     // Thriller
    'приключения': 12, // Adventure
    'фэнтези': 14,     // Fantasy
    'романтика': 10749, // Romance
    'семейный': 10751, // Family
    'мультфильм': 16,  // Animation
    
    // Emoji-based tags (extract text after emoji)
    'уют': 35,         // Cozy -> Comedy (light, feel-good)
    'мощная эмоция': 18, // Powerful emotion -> Drama
    'адреналин': 28,    // Adrenaline -> Action
  };

  const genreIds: number[] = [];
  const seen = new Set<number>();

  for (const genre of genres) {
    // Remove emojis and normalize
    const normalized = genre
      .replace(/[^\w\s]/g, '') // Remove emojis and special chars
      .toLowerCase()
      .trim();
    
    // Try direct match
    if (genreMap[normalized] && !seen.has(genreMap[normalized])) {
      genreIds.push(genreMap[normalized]);
      seen.add(genreMap[normalized]);
      continue;
    }
    
    // Try partial match (e.g., "мощная эмоция" contains "эмоция")
    for (const [key, id] of Object.entries(genreMap)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        if (!seen.has(id)) {
          genreIds.push(id);
          seen.add(id);
          break;
        }
      }
    }
  }

  return genreIds;
}

