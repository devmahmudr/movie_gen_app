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
   * @param format Optional format preference ('Фильм', 'Мультфильм', 'Сериал', 'Не важно')
   * @returns TMDb movie result with ID and poster path
   */
  async searchMovie(
    title: string,
    year?: number,
    language: string = 'ru-RU',
    format?: string,
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

      console.log(`[TMDb] Searching for: "${title}" (${year || 'no year'}, format: ${format || 'any'})`);
      const response = await axios.get(searchUrl, { params });

      if (
        !response.data ||
        !response.data.results ||
        response.data.results.length === 0
      ) {
        console.warn(`[TMDb] No results found for: "${title}"`);
        return null;
      }

      // Filter results based on format preference
      let candidates = response.data.results as TMDbMovieResult[];
      
      // Helper function to calculate title similarity (simple string matching)
      const normalizeTitle = (str: string): string => {
        return str.toLowerCase()
          .replace(/[^\w\s]/g, '') // Remove punctuation
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
      };
      
      const calculateTitleSimilarity = (title1: string, title2: string): number => {
        const norm1 = normalizeTitle(title1);
        const norm2 = normalizeTitle(title2);
        
        // Exact match
        if (norm1 === norm2) return 1.0;
        
        // Check if one contains the other (for cases like "The Matrix" vs "Matrix")
        if (norm1.includes(norm2) || norm2.includes(norm1)) {
          const shorter = norm1.length < norm2.length ? norm1 : norm2;
          const longer = norm1.length >= norm2.length ? norm1 : norm2;
          // If shorter is at least 70% of longer, consider it a good match
          const ratio = shorter.length / longer.length;
          return Math.max(ratio, 0.7); // Minimum 0.7 for contains matches
        }
        
        // Calculate word overlap using Jaccard similarity
        const words1 = new Set(norm1.split(' ').filter(w => w.length > 0));
        const words2 = new Set(norm2.split(' ').filter(w => w.length > 0));
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        
        if (union.size === 0) return 0;
        
        const jaccard = intersection.size / union.size;
        
        // Boost score if significant words match (at least 2 words or 50% of words)
        if (intersection.size >= 2 || (intersection.size > 0 && intersection.size / Math.min(words1.size, words2.size) >= 0.5)) {
          return Math.max(jaccard, 0.3); // Minimum 0.3 for good word overlap
        }
        
        return jaccard;
      };
      
      // Score candidates by title similarity and year match
      const scoredCandidates = candidates.map(candidate => {
        const titleSimilarity = calculateTitleSimilarity(title, candidate.title);
        const yearMatch = year && candidate.release_date 
          ? candidate.release_date.startsWith(year.toString()) ? 1.0 : 0.0
          : 0.5; // Neutral score if no year specified
        const combinedScore = titleSimilarity * 0.8 + yearMatch * 0.2;
        return { candidate, score: combinedScore, titleSimilarity };
      });
      
      // Sort by score (highest first)
      scoredCandidates.sort((a, b) => b.score - a.score);
      
      // Filter out candidates with very low title similarity (< 0.2) to avoid mismatches
      // Lowered from 0.3 to 0.2 to be more flexible while still avoiding obvious mismatches
      const validCandidates = scoredCandidates.filter(
        item => item.titleSimilarity >= 0.2
      );
      
      if (validCandidates.length === 0) {
        console.warn(`[TMDb] No candidates with sufficient title similarity for "${title}" (min 0.2)`);
        return null;
      }
      
      // Limit candidates to check (to avoid too many API calls) - check top 5 results
      const maxCandidatesToCheck = Math.min(5, validCandidates.length);
      const candidatesToCheck = validCandidates.slice(0, maxCandidatesToCheck).map(item => item.candidate);
      
      console.log(`[TMDb] Top candidate for "${title}": "${candidatesToCheck[0].title}" (similarity: ${validCandidates[0].titleSimilarity.toFixed(2)})`);
      
      // If format preference is specified, try to find a matching result
      if (format && format !== 'Не важно') {
        // First, try to find exact matches by checking genres
        // Animation genre typically indicates cartoons/animated films
        const animationGenres = ['Animation', 'Анимация', 'Мультфильм'];
        const isCartoonFormat = format === 'Мультфильм';
        const isMovieFormat = format === 'Фильм';
        
        // Try each candidate to find one that matches the format
        for (const candidate of candidatesToCheck) {
          try {
            // Fetch details to check genres
            const details = await this.getMovieDetails(candidate.id.toString(), language);
            const genres = details?.genres || [];
            const hasAnimationGenre = genres.some(g => 
              animationGenres.some(ag => g.toLowerCase().includes(ag.toLowerCase()))
            );
            
            // Validate format match
            if (isCartoonFormat && !hasAnimationGenre) {
              console.log(`[TMDb] Skipping ${candidate.title} - not a cartoon (format: ${format})`);
              continue;
            }
            
            if (isMovieFormat && hasAnimationGenre) {
              console.log(`[TMDb] Skipping ${candidate.title} - is a cartoon, but format is movie (format: ${format})`);
              continue;
            }
            
            // VALIDATION: Check if poster exists - if not, skip this candidate
            if (!candidate.poster_path || candidate.poster_path.trim() === '') {
              console.log(`[TMDb] Skipping ${candidate.title} - no poster (format: ${format})`);
              continue;
            }

            // Found a match
            console.log(`[TMDb] Found matching movie: ${candidate.title} (ID: ${candidate.id}, format: ${format})`);
            const movie = candidate;
            
            return {
              movieId: movie.id.toString(),
              title: movie.title,
              posterPath: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
              genres: genres,
              releaseYear: movie.release_date ? movie.release_date.split('-')[0] : '',
              overview: details?.overview,
              country: details?.country,
              imdbRating: details?.imdbRating,
              runtime: details?.runtime,
              ageRating: details?.ageRating,
            };
          } catch (detailError) {
            console.warn(`[TMDb] Error checking details for ${candidate.title}:`, detailError);
            continue;
          }
        }
        
        // If no format-matched result found, return null to allow retry with different movie
        console.warn(`[TMDb] No format-matched result found for "${title}" with format "${format}" after checking ${maxCandidatesToCheck} candidates`);
        return null;
      }

      // Get the best matching candidate (highest similarity score) if no format filtering or no match found
      const bestCandidate = validCandidates[0];
      const movie = bestCandidate.candidate as TMDbMovieResult;
      
      // Double-check title similarity before returning
      if (bestCandidate.titleSimilarity < 0.5) {
        console.warn(`[TMDb] Low title similarity (${bestCandidate.titleSimilarity.toFixed(2)}) for "${title}" vs "${movie.title}". This might be a mismatch.`);
      }
      
      console.log(`[TMDb] Found movie: ${movie.title} (ID: ${movie.id}, similarity: ${bestCandidate.titleSimilarity.toFixed(2)})`);

      // Fetch full details to get genres, overview, country, and IMDb rating
      const details = await this.getMovieDetails(movie.id.toString(), language);

      // VALIDATION: Check if poster exists - if not, return null (movie is invalid without poster)
      if (!movie.poster_path || movie.poster_path.trim() === '') {
        console.warn(`[TMDb] Movie "${movie.title}" (ID: ${movie.id}) has no poster - rejecting`);
        return null;
      }

      const posterPath = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;

      return {
        movieId: movie.id.toString(),
        title: movie.title,
        posterPath: posterPath,
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
      // Only return country if it exists and is not empty
      const country = response.data.production_countries?.[0]?.name?.trim() || undefined;

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

      // Helper function to validate and clamp IMDb rating to 0-10 range
      const validateImdbRating = (rating: number): number => {
        if (isNaN(rating) || rating < 0) return 0;
        if (rating > 10) {
          console.warn(`[TMDb] IMDb rating ${rating} exceeds 10, clamping to 10`);
          return 10;
        }
        return parseFloat(rating.toFixed(1));
      };

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
            const rawRating = parseFloat(omdbResponse.data.imdbRating);
            imdbRating = validateImdbRating(rawRating);
          }
        } catch (omdbError) {
          // If OMDb fails, use TMDb vote_average as fallback
          // TMDb vote_average is already on 0-10 scale, use it directly
          console.log(`[TMDb] OMDb API not available, using TMDb rating for ${movieId}`);
          if (response.data.vote_average !== undefined && response.data.vote_average !== null) {
            imdbRating = validateImdbRating(response.data.vote_average);
          }
        }
      } else if (response.data.vote_average !== undefined && response.data.vote_average !== null) {
        // Fallback to TMDb rating if no IMDb ID
        // TMDb vote_average is already on 0-10 scale, use it directly
        imdbRating = validateImdbRating(response.data.vote_average);
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
      
      // For Russian interface, be strict - only return Russian trailers
      // For other languages, we can be more lenient
      const isStrictLanguage = targetLanguageCode === 'ru';

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

      // If strict language mode (Russian), don't fall back to other languages
      // Return null so YouTube search can try instead
      if (isStrictLanguage) {
        console.log(`[TMDb] No ${targetLanguageCode} videos found for movie ${movieId}, returning null (strict mode)`);
        return null;
      }

      // For non-strict languages (e.g., English), fall back to any official video
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

      // Last resort: any YouTube video (only for non-strict languages)
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
            let bestMatch: any = null;

            // For Russian interface, be strict - only return Russian trailers
            if (isRussianInterface) {
              // Priority 1: Videos with Russian trailer keywords ("трейлер", "русский", "рус")
              for (const item of response.data.items) {
                const title = item.snippet?.title?.toLowerCase() || '';
                const description = item.snippet?.description?.toLowerCase() || '';
                const combined = title + ' ' + description;

                // Check for Russian trailer indicators
                const hasRussianTrailerKeyword = 
                  combined.includes('трейлер') || 
                  combined.includes('русский') || 
                  combined.includes('рус') ||
                  combined.includes('russian trailer');

                // Exclude English-only trailers (if title has "trailer" but no Russian keywords)
                const hasEnglishOnly = 
                  title.includes('trailer') && 
                  !combined.includes('трейлер') && 
                  !combined.includes('русский') && 
                  !combined.includes('рус') &&
                  !combined.includes('russian');

                if (hasRussianTrailerKeyword && !hasEnglishOnly) {
                  bestMatch = item;
                  console.log(`[YouTube] Found Russian trailer match: ${title}`);
                  break;
                }
              }

              // If no Russian trailer found, don't fall back to English - return null
              if (!bestMatch) {
                console.log(`[YouTube] No Russian trailer found for "${query}", skipping English trailers`);
                continue; // Try next query
              }
            } else {
              // For non-Russian interface, use standard logic
              // Priority 1: Videos with "trailer" keyword
              for (const item of response.data.items) {
                const title = item.snippet?.title?.toLowerCase() || '';
                if (title.includes('trailer') || title.includes('трейлер')) {
                  bestMatch = item;
                  break;
                }
              }

              // Fallback to first result if no trailer keyword found
              if (!bestMatch) {
                bestMatch = response.data.items[0];
              }
            }

            const videoId = bestMatch?.id?.videoId;
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

