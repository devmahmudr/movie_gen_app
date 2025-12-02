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
   * @returns TMDb movie result with ID and poster path
   */
  async searchMovie(
    title: string,
    year?: number,
  ): Promise<{
    movieId: string;
    title: string;
    posterPath: string;
    genres: string[];
    releaseYear: string;
  } | null> {
    try {
      const searchUrl = `${this.baseUrl}/search/movie`;
      const params: any = {
        api_key: this.apiKey,
        query: title,
        language: 'ru-RU',
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

      // Fetch full details to get genres
      const details = await this.getMovieDetails(movie.id.toString());

      return {
        movieId: movie.id.toString(),
        title: movie.title,
        posterPath: movie.poster_path
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
          : '',
        genres: details?.genres || [],
        releaseYear: movie.release_date ? movie.release_date.split('-')[0] : '',
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
   * Get movie details by TMDb ID including genres
   * @param movieId TMDb movie ID
   * @returns Movie details with genres
   */
  async getMovieDetails(
    movieId: string,
  ): Promise<{ genres: string[] } | null> {
    try {
      const movieUrl = `${this.baseUrl}/movie/${movieId}`;
      const response = await axios.get(movieUrl, {
        params: {
          api_key: this.apiKey,
          language: 'ru-RU',
        },
      });

      const genres = response.data.genres?.map((g: any) => g.name) || [];
      console.log(`[TMDb] Genres for movie ${movieId}:`, genres);

      return { genres };
    } catch (error) {
      console.error(`[TMDb] Get movie details error for ID "${movieId}":`, error.message);
      return null;
    }
  }

  /**
   * Get movie videos (trailers) by TMDb ID
   * @param movieId TMDb movie ID
   * @returns YouTube video key or null
   */
  async getMovieVideos(movieId: string): Promise<string | null> {
    try {
      const videosUrl = `${this.baseUrl}/movie/${movieId}/videos`;
      const response = await axios.get(videosUrl, {
        params: {
          api_key: this.apiKey,
          language: 'en-US',
        },
      });

      if (
        !response.data ||
        !response.data.results ||
        response.data.results.length === 0
      ) {
        return null;
      }

      // Find the first trailer hosted on YouTube
      const trailer = response.data.results.find(
        (video: any) =>
          video.site === 'YouTube' &&
          (video.type === 'Trailer' || video.type === 'Teaser'),
      );

      return trailer ? trailer.key : null;
    } catch (error) {
      console.error(
        `TMDb get videos error for ID "${movieId}":`,
        error.message,
      );
      return null;
    }
  }
}

