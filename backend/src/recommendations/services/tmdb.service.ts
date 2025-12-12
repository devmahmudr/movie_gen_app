import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { isAxiosError } from 'axios';
// Cache removed from project
import { RECOMMENDATION_CONFIG } from '../constants/recommendation.config';

export interface TMDbMovieResult {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
}

@Injectable()
export class TMDbService {
  private readonly logger = new Logger(TMDbService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly youtubeApiKey: string;

  constructor(
    private configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('TMDB_API_KEY');
    this.baseUrl =
      this.configService.get<string>('TMDB_BASE_URL') ||
      'https://api.themoviedb.org/3';
    this.youtubeApiKey = this.configService.get<string>('YOUTUBE_API_KEY') || '';
  }

  /**
   * Log HTTP request details (removed - only errors logged)
   */
  private logRequest(method: string, url: string, params?: any, data?: any) {
    // Logging removed per requirements
  }

  /**
   * Log HTTP response details (removed - only errors logged)
   */
  private logResponse(method: string, url: string, status: number, data: any, duration?: number) {
    // Logging removed per requirements
  }

  /**
   * Log HTTP error details
   */
  private logError(method: string, url: string, error: any) {
    this.logger.error(`[HTTP ERROR] ${method} ${url}`, error.stack, 'TMDbService', {
      method,
      url,
      errorMessage: error.message,
      errorCode: error.code,
      responseStatus: error.response?.status,
      responseData: error.response?.data,
    });
  }

  /**
   * Search for a movie by title and year
   * This method's only responsibility is to find the correct movie ID.
   * All data fetching is delegated to getMovieDetails, which is the single source of truth.
   * @param title Movie title
   * @param year Optional year for better matching
   * @param language Optional language code (defaults to 'ru-RU')
   * @returns TMDb movie result with ID and all metadata from getMovieDetails
   */
  /**
   * Normalize title for fuzzy matching
   * Removes special characters, spaces, and converts to lowercase
   */
  private normalizeTitle(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Check if two titles match using fuzzy matching
   */
  private titlesMatch(title1: string, title2: string): boolean {
    const normalized1 = this.normalizeTitle(title1);
    const normalized2 = this.normalizeTitle(title2);
    return normalized1 === normalized2;
  }

  async searchMovie(
    title: string,
    year?: number,
    language: string = 'ru-RU',
  ): Promise<{
    movieId: string;
    title: string;
    posterPath: string;
    genres: string[];
    releaseYear: string;
    overview?: string;
    country?: string;
    imdbRating?: number;
    runtime?: number;
    ageRating?: string;
  } | null> {
    const startTime = Date.now();

    try {
      // Step 1: Search TMDb to find the correct Movie ID. This is the only goal of this step.
      const searchUrl = `${this.baseUrl}/search/movie`;
      const params: any = { api_key: this.apiKey, query: title, language, page: 1 };
      if (year) {
        params.year = year;
      }

      const response = await axios.get(searchUrl, { params, timeout: 4000 });

      if (!response.data?.results || response.data.results.length === 0) {
        return null;
      }

      // Step 1.5: Find the best match using fuzzy matching
      // Try to find an exact or fuzzy match from the search results
      let bestMatch = null;
      const normalizedSearchTitle = this.normalizeTitle(title);

      // First, try exact match (case-insensitive)
      for (const result of response.data.results) {
        if (this.titlesMatch(title, result.title)) {
          bestMatch = result;
          break;
        }
      }

      // If no exact match, try fuzzy match (normalized comparison)
      if (!bestMatch) {
        for (const result of response.data.results) {
          const normalizedResultTitle = this.normalizeTitle(result.title);
          if (normalizedSearchTitle === normalizedResultTitle) {
            bestMatch = result;
            break;
          }
        }
      }

      // If still no match, use the first result (TMDb's best guess)
      if (!bestMatch) {
        bestMatch = response.data.results[0];
      }

      // We found a potential match. Get its ID.
      const foundMovieId = bestMatch.id.toString();

      // --- Step 2: Use the found ID to get the definitive, cached, and complete movie details. ---
      // This is now the SINGLE SOURCE OF TRUTH for all movie metadata.
      const details = await this.getMovieDetails(foundMovieId, language);

      // If getMovieDetails fails for any reason (including caching issues or API errors), we fail the search.
      if (!details) {
        return null;
      }

      // --- Step 3: Assemble the final result using ONLY data from the details object. ---
      // The details object now contains the posterPath and the correct title.
      const result = {
        movieId: foundMovieId,
        title: details.title || response.data.results[0].title, // Fallback to search title just in case
        posterPath: details.posterPath || '',

        // All other metadata comes directly from our robust details call.
        genres: details.genres,
        releaseYear: details.releaseYear,
        overview: details.overview,
        country: details.country,
        imdbRating: details.imdbRating,
        runtime: details.runtime,
        ageRating: details.ageRating,
      };

      const duration = Date.now() - startTime;

      return result;
    } catch (error) {
      this.logError('GET', `${this.baseUrl}/search/movie`, error);
      this.logger.error(`[TMDb] Critical search error for "${title}"`, error.stack, 'TMDbService');
      return null;
    }
  }

  /**
   * Get movie details by TMDb ID - CACHE-FIRST, STATELESS VERSION
   * This is the single source of truth for all movie metadata. It is atomic, cached, and stateless.
   * @param movieId TMDb movie ID
   * @param language Optional language code (defaults to 'ru-RU')
   * @returns Movie details with genres, overview, country, IMDb rating, poster, and title
   */
  async getMovieDetails(
    movieId: string,
    language: string = 'ru-RU',
  ): Promise<{
    genres: string[];
    overview: string;
    country: string;
    imdbRating?: number;
    runtime?: number;
    ageRating?: string;
    releaseYear: string;
    posterPath?: string;
    title?: string;
  } | null> {
    // Cache removed - fetching fresh data

    try {
      // Step 2: Fetch data from TMDb. All variables are local to this function scope.
      const movieUrl = `${this.baseUrl}/movie/${movieId}`;
      const params = {
        api_key: this.apiKey,
        language,
        append_to_response: 'external_ids,release_dates',
      };

      const response = await axios.get(movieUrl, { params, timeout: 5000 });

      const data = response.data;
      if (!data || !data.id || data.id.toString() !== movieId) {
        this.logger.error(`TMDb response error! Requested: ${movieId}, but got data for: ${data?.id}`, '', 'TMDbService', {
          requestedMovieId: movieId,
          receivedMovieId: data?.id,
        });
        return null;
      }

      // --- Step 3: Extract data into local variables. This is critical for isolation. ---
      const genres = data.genres?.map((g: any) => g.name) || [];
      const overview = data.overview || '';
      const country = data.production_countries?.[0]?.name || '';
      const runtime = data.runtime || undefined;
      const releaseYear = data.release_date ? data.release_date.split('-')[0] : '';
      const imdbId = data.external_ids?.imdb_id;
      // CRITICAL: Get poster path from the full movie details to ensure it matches the movie ID
      const posterPath = data.poster_path
        ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
        : undefined;
      const title = data.title || undefined;

      // --- Step 4: Perform sub-tasks to get more data ---

      // Fetch IMDb rating (can fail gracefully)
      let imdbRating: number | undefined;
      if (imdbId && this.configService.get('OMDB_API_KEY')) {
        try {
          const omdbRes = await axios.get(`http://www.omdbapi.com/`, {
            params: { i: imdbId, apikey: this.configService.get('OMDB_API_KEY') },
            timeout: 3000,
          });
          if (omdbRes.data?.imdbRating && omdbRes.data.imdbRating !== 'N/A') {
            imdbRating = parseFloat(omdbRes.data.imdbRating);
          }
        } catch {
          // Fail silently - OMDb is optional
        }
      }
      if (!imdbRating && data.vote_average) {
        imdbRating = parseFloat(data.vote_average.toFixed(1));
      }

      // Parse Age Rating (this is a self-contained operation)
      const ageRating = this.parseAgeRating(data.release_dates?.results);

      // Step 5: Assemble the final result object.
      const result = {
        genres,
        overview,
        country,
        imdbRating,
        runtime,
        ageRating,
        releaseYear,
        posterPath,
        title
      };

      // Cache removed - data returned directly

      return result;

    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : 'unknown';
      this.logger.error(`Failed to get details for movie ${movieId}. Status: ${status}`, error.stack, 'TMDbService');
      return null;
    }
  }

  /**
   * Parse age rating from release dates - extracted as private method for isolation
   * This function intelligently searches for and prioritizes meaningful age ratings
   * across multiple regions, ignoring empty certifications.
   */
  private parseAgeRating(releaseDates: any[]): string | undefined {
    if (!releaseDates || !Array.isArray(releaseDates) || releaseDates.length === 0) {
      return undefined;
    }

    // Mapping of US MPA certifications to a common format
    const usCertToAge: { [key: string]: string } = {
      'G': '0+',
      'PG': '6+',
      'PG-13': '12+',
      'R': '16+',
      'NC-17': '18+',
    };

    // Helper to find the best certification for a given country's data
    const findBestCertification = (countryData: any): string | null => {
      if (!countryData || !Array.isArray(countryData.release_dates)) {
        return null;
      }

      // Priority order for release types (Theatrical > Digital > Premiere)
      const typePriority = [3, 4, 1, 2, 5, 6];

      for (const type of typePriority) {
        const release = countryData.release_dates.find((rd: any) => rd.type === type);
        // CRITICAL FIX: Only consider a certification if it is a non-empty string.
        if (
          release &&
          release.certification &&
          typeof release.certification === 'string' &&
          release.certification.trim() !== ''
        ) {
          return release.certification.trim();
        }
      }
      return null; // No meaningful certification found for this country
    };

    // --- SEARCH STRATEGY ---
    // Priority 1: Search high-priority numeric-rating countries (Russia is top)
    const priorityCountries = ['RU', 'DE', 'FR', 'ES', 'GB', 'BR'];
    for (const countryCode of priorityCountries) {
      const countryData = releaseDates.find((r: any) => r.iso_3166_1 === countryCode);
      const cert = findBestCertification(countryData);
      if (cert) {
        // Check for a simple number (e.g., "16")
        const numericMatch = cert.match(/^(\d+)$/);
        if (numericMatch) {
          return `${numericMatch[1]}+`;
        }
        // Check for formats like "12+", "18+", etc.
        if (/^\d+\+$/.test(cert)) {
          return cert;
        }
      }
    }

    // Priority 2: Check the United States (US) and convert its rating. This is very reliable.
    const usData = releaseDates.find((r: any) => r.iso_3166_1 === 'US');
    const usCert = findBestCertification(usData);
    if (usCert && usCertToAge[usCert]) {
      return usCertToAge[usCert];
    }

    // Priority 3: Last resort. Iterate through ALL remaining countries and take the first valid-looking numeric rating.
    for (const countryData of releaseDates) {
      // Skip countries we've already checked
      if (priorityCountries.includes(countryData.iso_3166_1) || countryData.iso_3166_1 === 'US') {
        continue;
      }

      const cert = findBestCertification(countryData);
      if (cert) {
        const numericMatch = cert.match(/^(\d+)/); // Match the first number found (e.g., "12A")
        if (numericMatch) {
          return `${numericMatch[1]}+`;
        }
      }
    }

    // If no rating is found after all checks, return undefined.
    return undefined;
  }

  /**
   * Get movie videos (trailers) by TMDb ID
   * @param movieId TMDb movie ID
   * @param language Optional language code (defaults to 'ru-RU')
   * @returns YouTube video key or null
   */
  async getMovieVideos(movieId: string, language: string = 'ru-RU'): Promise<string | null> {
    const startTime = Date.now();
    try {
      const videosUrl = `${this.baseUrl}/movie/${movieId}/videos`;

      // First, try with the requested language
      const params1 = {
        api_key: this.apiKey,
        language: language,
      };
      let response = await axios.get(videosUrl, {
        params: params1,
      });

      // If no results, try without language parameter (gets all languages)
      if (!response.data?.results || response.data.results.length === 0) {
        const params2 = {
          api_key: this.apiKey,
        };
        response = await axios.get(videosUrl, {
          params: params2,
        });
      }

      if (
        !response.data ||
        !response.data.results ||
        response.data.results.length === 0
      ) {
        return null;
      }

      const videos = response.data.results;

      // Extract language code from language parameter (e.g., 'ru-RU' -> 'ru')
      const targetLanguageCode = language.split('-')[0].toLowerCase();

      // Priority order: Trailer > Teaser > Clip > Featurette > Behind the Scenes
      const videoTypes = ['Trailer', 'Teaser', 'Clip', 'Featurette', 'Behind the Scenes'];

      // First, try to find videos matching the target language
      for (const type of videoTypes) {
        const video = videos.find(
          (v: any) =>
            v.site === 'YouTube' &&
            v.type === type &&
            v.official === true &&
            v.iso_639_1?.toLowerCase() === targetLanguageCode, // Match language
        );

        if (video) {
          return video.key;
        }
      }

      // If no official videos in target language, try any video in target language
      for (const type of videoTypes) {
        const video = videos.find(
          (v: any) =>
            v.site === 'YouTube' &&
            v.type === type &&
            v.iso_639_1?.toLowerCase() === targetLanguageCode, // Match language
        );

        if (video) {
          return video.key;
        }
      }

      // If no videos in target language, fall back to any official video
      for (const type of videoTypes) {
        const video = videos.find(
          (v: any) =>
            v.site === 'YouTube' &&
            v.type === type &&
            v.official === true,
        );

        if (video) {
          return video.key;
        }
      }

      // If no official videos found, try any YouTube video of the preferred types
      for (const type of videoTypes) {
        const video = videos.find(
          (v: any) =>
            v.site === 'YouTube' &&
            v.type === type,
        );

        if (video) {
          return video.key;
        }
      }

      // Last resort: any YouTube video
      const anyYouTubeVideo = videos.find((v: any) => v.site === 'YouTube');
      if (anyYouTubeVideo) {
        return anyYouTubeVideo.key;
      }

      return null;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logError('GET', `${this.baseUrl}/movie/${movieId}/videos`, error);
      this.logger.error(
        `TMDb get videos error for ID "${movieId}"`,
        error.stack,
        'TMDbService',
        {
          movieId,
          language,
          error: error.message,
          duration: `${duration}ms`,
        },
      );
      return null;
    }
  }

  /**
   * Get movie titles in both Russian and English
   * @param movieId TMDb movie ID
   * @returns Object with Russian and English titles
   */
  async getMovieTitles(movieId: string): Promise<{ titleRu: string; titleEn: string } | null> {
    const startTime = Date.now();
    try {
      // Fetch Russian title
      const ruUrl = `${this.baseUrl}/movie/${movieId}`;
      const ruParams = {
        api_key: this.apiKey,
        language: 'ru-RU',
      };
      const ruResponse = await axios.get(ruUrl, {
        params: ruParams,
      });

      // Fetch English title
      const enUrl = `${this.baseUrl}/movie/${movieId}`;
      const enParams = {
        api_key: this.apiKey,
        language: 'en-US',
      };

      const enResponse = await axios.get(enUrl, {
        params: enParams,
      });

      const result = {
        titleRu: ruResponse.data?.title || '',
        titleEn: enResponse.data?.title || '',
      };

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logError('GET', `${this.baseUrl}/movie/${movieId}`, error);
      this.logger.error(`[TMDb] Error fetching titles for movie ${movieId}`, error.stack, 'TMDbService', {
        movieId,
        error: error.message,
        duration: `${duration}ms`,
      });
      return null;
    }
  }

  /**
   * Search for movie trailer on YouTube using language-specific queries
   * @param movieTitleRus Russian movie title
   * @param movieTitleEn English movie title
   * @param interfaceLanguage Interface language ('ru' or 'en')
   * @returns YouTube video ID or null
   */
  async searchTrailerOnYouTube(
    movieTitleRus: string,
    movieTitleEn: string,
    interfaceLanguage: string = 'ru',
  ): Promise<string | null> {
    if (!this.youtubeApiKey) {
      return null;
    }

    const startTime = Date.now();
    try {
      const isRussianInterface = interfaceLanguage.toLowerCase() === 'ru' || interfaceLanguage.toLowerCase().startsWith('ru');

      // Define search queries based on interface language
      const searchQueries: string[] = [];

      if (isRussianInterface) {
        // For Russian interface: try Russian title first
        searchQueries.push(`${movieTitleRus} трейлер`);
        // Fallback queries
        searchQueries.push(`${movieTitleEn} russian trailer`);
        searchQueries.push(`${movieTitleEn} трейлер`);
      } else {
        // For English interface: only English trailers
        searchQueries.push(`${movieTitleEn} trailer`);
      }


      // Try each query in order
      for (const query of searchQueries) {
        try {
          const searchUrl = 'https://www.googleapis.com/youtube/v3/search';
          const params = {
            part: 'snippet',
            q: query,
            type: 'video',
            maxResults: 10, // Increased to get more candidates
            key: this.youtubeApiKey,
            videoCategoryId: '1', // Film & Animation category
            relevanceLanguage: interfaceLanguage, // Filter results by interface language
          };

          const response = await axios.get(searchUrl, {
            params,
          });

          if (response.data?.items && response.data.items.length > 0) {
            // Find the best match based on language and trailer keywords
            let bestMatch = response.data.items[0];

            // Priority 1: Videos with language-specific trailer keywords
            if (isRussianInterface) {
              // For Russian: prioritize "трейлер" or "русский" in title/description
              for (const item of response.data.items) {
                const title = item.snippet?.title?.toLowerCase() || '';
                const description = item.snippet?.description?.toLowerCase() || '';
                const combined = title + ' ' + description;

                if (combined.includes('трейлер') || combined.includes('русский')) {
                  bestMatch = item;
                  break;
                }
              }
            }

            // Priority 2: Videos with "trailer" keyword (any language)
            if (!bestMatch || bestMatch === response.data.items[0]) {
              for (const item of response.data.items) {
                const title = item.snippet?.title?.toLowerCase() || '';
                if (title.includes('trailer') || title.includes('трейлер')) {
                  bestMatch = item;
                  break;
                }
              }
            }

            const videoId = bestMatch.id?.videoId;
            if (videoId) {
              return videoId;
            }
          }
        } catch (error) {
          // Continue to next query
          continue;
        }
      }

      const totalDuration = Date.now() - startTime;
      return null;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logError('GET', 'https://www.googleapis.com/youtube/v3/search', error);
      this.logger.error('[YouTube] Error searching for trailer', error.stack, 'TMDbService', {
        movieTitleRus,
        movieTitleEn,
        interfaceLanguage,
        error: error.message,
        duration: `${duration}ms`,
      });
      return null;
    }
  }
}

