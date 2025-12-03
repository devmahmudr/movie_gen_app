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

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('TMDB_API_KEY');
    this.baseUrl =
      this.configService.get<string>('TMDB_BASE_URL') ||
      'https://api.themoviedb.org/3';
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
  } | null> {
    try {
      const movieUrl = `${this.baseUrl}/movie/${movieId}`;
      const response = await axios.get(movieUrl, {
        params: {
          api_key: this.apiKey,
          language: language,
          append_to_response: 'external_ids',
        },
      });

      const genres = response.data.genres?.map((g: any) => g.name) || [];
      const overview = response.data.overview || '';
      
      // Get country from production_countries (first country)
      const country = response.data.production_countries?.[0]?.name || '';
      
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
      });

      return { genres, overview, country, imdbRating };
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
}

