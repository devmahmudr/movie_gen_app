import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface TMDbMovieResult {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
}

@Injectable()
export class TMDbService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly youtubeApiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('TMDB_API_KEY');
    this.baseUrl =
      this.configService.get<string>('TMDB_BASE_URL') ||
      'https://api.themoviedb.org/3';
    this.youtubeApiKey = this.configService.get<string>('YOUTUBE_API_KEY') || '';
  }

  /**
   * Search for a movie by title and year
   * @param title Movie title
   * @param year Optional year for better matching
   * @param language Optional language code (defaults to 'ru-RU')
   * @returns TMDb movie result with ID and poster path
   */
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
    try {
      const searchUrl = `${this.baseUrl}/search/movie`;
      const params: any = {
        api_key: this.apiKey,
        query: title,
        language: language,
        page: 1,
      };

      if (year) {
        params.year = year;
      }

      console.log(`[TMDb] Searching for: "${title}" (${year || 'no year'})`);
      const response = await axios.get(searchUrl, { params });

      if (
        !response.data ||
        !response.data.results ||
        response.data.results.length === 0
      ) {
        console.warn(`[TMDb] No results found for: "${title}"`);
        return null;
      }

      // Get the first result (most relevant)
      const movie = response.data.results[0] as TMDbMovieResult;
      console.log(`[TMDb] Found movie: ${movie.title} (ID: ${movie.id})`);

      // Fetch full details to get genres, overview, country, and IMDb rating
      const details = await this.getMovieDetails(movie.id.toString(), language);

      return {
        movieId: movie.id.toString(),
        title: movie.title,
        posterPath: movie.poster_path
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
          : '',
        genres: details?.genres || [],
        releaseYear: movie.release_date ? movie.release_date.split('-')[0] : '',
        overview: details?.overview,
        country: details?.country,
        imdbRating: details?.imdbRating,
        runtime: details?.runtime,
        ageRating: details?.ageRating,
      };
    } catch (error) {
      console.error(`[TMDb] Search error for "${title}":`, error.message);
      return null;
    }
  }

  /**
   * Get movie details by TMDb ID
   * @param movieId TMDb movie ID
   * @returns Movie details with poster path
   */
  /**
   * Get movie details by TMDb ID including genres, overview, country, and IMDb rating
   * @param movieId TMDb movie ID
   * @param language Optional language code (defaults to 'ru-RU')
   * @returns Movie details with genres, overview, country, and IMDb rating
   */
  async getMovieDetails(
    movieId: string,
    language: string = 'ru-RU',
  ): Promise<{
    genres: string[];
    overview?: string;
    country?: string;
    imdbRating?: number;
    runtime?: number;
    ageRating?: string;
  } | null> {
    try {
      const movieUrl = `${this.baseUrl}/movie/${movieId}`;
      const response = await axios.get(movieUrl, {
        params: {
          api_key: this.apiKey,
          language: language,
          append_to_response: 'external_ids,release_dates',
        },
      });

      const genres = response.data.genres?.map((g: any) => g.name) || [];
      const overview = response.data.overview || '';

      // Get country from production_countries (first country)
      const country = response.data.production_countries?.[0]?.name || '';

      // Get runtime in minutes
      const runtime = response.data.runtime || undefined;

      // Get certification/age rating from release_dates
      // Prefer numeric age ratings (EU/RU format: 0+, 6+, 12+, 16+, 18+)
      let ageRating: string | undefined;
      try {
        const releaseDates = response.data.release_dates?.results || [];

        // Mapping of US certifications to numeric age ratings
        const usCertToAge: { [key: string]: string } = {
          'G': '0+',
          'PG': '7+',
          'PG-13': '13+',
          'R': '18+',
          'NC-17': '18+',
        };

        // Try to find numeric ratings first (EU countries, Russia, etc.)
        const numericRatingCountries = ['RU', 'DE', 'FR', 'GB', 'ES', 'IT', 'NL', 'BE', 'PL', 'CZ', 'SE', 'NO', 'DK', 'FI'];
        for (const countryCode of numericRatingCountries) {
          const countryRelease = releaseDates.find((r: any) => r.iso_3166_1 === countryCode);
          const cert = countryRelease?.release_dates?.find((rd: any) => rd.certification)?.certification;
          if (cert) {
            // Check if it's already numeric (contains + or is a number)
            if (/^\d+\+?$/.test(cert) || cert.includes('+')) {
              ageRating = cert.includes('+') ? cert : `${cert}+`;
              break;
            }
          }
        }

        // If no numeric rating found, try US and convert it
        if (!ageRating) {
          const usRelease = releaseDates.find((r: any) => r.iso_3166_1 === 'US');
          const usCert = usRelease?.release_dates?.find((rd: any) => rd.certification)?.certification;
          if (usCert && usCertToAge[usCert]) {
            ageRating = usCertToAge[usCert];
          } else if (usCert) {
            // If it's an unknown US cert, try to parse it as numeric or default to 18+
            ageRating = /^\d+\+?$/.test(usCert) ? (usCert.includes('+') ? usCert : `${usCert}+`) : '18+';
          }
        }

        // Last resort: try any other certification
        if (!ageRating) {
          for (const release of releaseDates) {
            const cert = release.release_dates?.find((rd: any) => rd.certification)?.certification;
            if (cert) {
              if (/^\d+\+?$/.test(cert)) {
                ageRating = cert.includes('+') ? cert : `${cert}+`;
                break;
              }
            }
          }
        }
      } catch (certError) {
        console.log(`[TMDb] Could not fetch certification for ${movieId}`);
      }

      // Get IMDb ID and fetch rating
      const imdbId = response.data.external_ids?.imdb_id;
      let imdbRating: number | undefined;

      if (imdbId) {
        try {
          // Fetch IMDb rating from OMDb API (free tier available)
          // Alternative: Use TMDb's own rating if available
          // For now, we'll use vote_average as a fallback and try to get IMDb rating
          const omdbResponse = await axios.get(`http://www.omdbapi.com/`, {
            params: {
              i: imdbId,
              apikey: process.env.OMDB_API_KEY || '', // Optional: add OMDb API key to env
            },
            timeout: 3000, // 3 second timeout
          });

          if (omdbResponse.data?.imdbRating) {
            imdbRating = parseFloat(omdbResponse.data.imdbRating);
          }
        } catch (omdbError) {
          // If OMDb fails, use TMDb vote_average as fallback (scale to 10)
          console.log(`[TMDb] OMDb API not available, using TMDb rating for ${movieId}`);
          if (response.data.vote_average) {
            imdbRating = parseFloat((response.data.vote_average * 1.111).toFixed(1)); // Scale 0-9 to 0-10
          }
        }
      } else if (response.data.vote_average) {
        // Fallback to TMDb rating if no IMDb ID
        imdbRating = parseFloat((response.data.vote_average * 1.111).toFixed(1));
      }

      console.log(`[TMDb] Details for movie ${movieId}:`, {
        genres,
        hasOverview: !!overview,
        country,
        imdbRating,
        runtime,
        ageRating,
      });

      return { genres, overview, country, imdbRating, runtime, ageRating };
    } catch (error) {
      console.error(`[TMDb] Get movie details error for ID "${movieId}":`, error.message);
      return null;
    }
  }

  /**
   * Get movie videos (trailers) by TMDb ID
   * @param movieId TMDb movie ID
   * @param language Optional language code (defaults to 'ru-RU')
   * @returns YouTube video key or null
   */
  async getMovieVideos(movieId: string, language: string = 'ru-RU'): Promise<string | null> {
    try {
      const videosUrl = `${this.baseUrl}/movie/${movieId}/videos`;

      // First, try with the requested language
      let response = await axios.get(videosUrl, {
        params: {
          api_key: this.apiKey,
          language: language,
        },
      });

      // If no results, try without language parameter (gets all languages)
      if (!response.data?.results || response.data.results.length === 0) {
        response = await axios.get(videosUrl, {
          params: {
            api_key: this.apiKey,
          },
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
          console.log(`[TMDb] Found ${type} in ${targetLanguageCode} for movie ${movieId}: ${video.key}`);
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
          console.log(`[TMDb] Found unofficial ${type} in ${targetLanguageCode} for movie ${movieId}: ${video.key}`);
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
          console.log(`[TMDb] Found ${type} (fallback, not in ${targetLanguageCode}) for movie ${movieId}: ${video.key}`);
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
          console.log(`[TMDb] Found unofficial ${type} (fallback) for movie ${movieId}: ${video.key}`);
          return video.key;
        }
      }

      // Last resort: any YouTube video
      const anyYouTubeVideo = videos.find((v: any) => v.site === 'YouTube');
      if (anyYouTubeVideo) {
        console.log(`[TMDb] Found any YouTube video (last resort) for movie ${movieId}: ${anyYouTubeVideo.key}`);
        return anyYouTubeVideo.key;
      }

      return null;
    } catch (error) {
      console.error(
        `TMDb get videos error for ID "${movieId}":`,
        error.message,
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
    try {
      // Fetch Russian title
      const ruResponse = await axios.get(`${this.baseUrl}/movie/${movieId}`, {
        params: {
          api_key: this.apiKey,
          language: 'ru-RU',
        },
      });

      // Fetch English title
      const enResponse = await axios.get(`${this.baseUrl}/movie/${movieId}`, {
        params: {
          api_key: this.apiKey,
          language: 'en-US',
        },
      });

      return {
        titleRu: ruResponse.data?.title || '',
        titleEn: enResponse.data?.title || '',
      };
    } catch (error) {
      console.error(`[TMDb] Error fetching titles for movie ${movieId}:`, error.message);
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
      console.warn('[YouTube] API key not configured, skipping YouTube search');
      return null;
    }

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
          const response = await axios.get(searchUrl, {
            params: {
              part: 'snippet',
              q: query,
              type: 'video',
              maxResults: 10, // Increased to get more candidates
              key: this.youtubeApiKey,
              videoCategoryId: '1', // Film & Animation category
              relevanceLanguage: interfaceLanguage, // Filter results by interface language
            },
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
                  console.log(`[YouTube] Found Russian trailer match: ${title}`);
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
              console.log(`[YouTube] Found trailer for "${query}": ${videoId} (${bestMatch.snippet?.title})`);
              return videoId;
            }
          }
        } catch (error) {
          console.warn(`[YouTube] Search failed for query "${query}":`, error.message);
          // Continue to next query
          continue;
        }
      }

      console.log(`[YouTube] No trailer found for movie: ${movieTitleRus} / ${movieTitleEn}`);
      return null;
    } catch (error) {
      console.error('[YouTube] Error searching for trailer:', error.message);
      return null;
    }
  }
}

