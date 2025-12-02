import {
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { MovieHistory } from '../entities/movie-history.entity';
import { RecommendDto } from './dto';
import { OpenAIService } from './services/openai.service';
import { TMDbService } from './services/tmdb.service';
import { Movie } from './interfaces/movie.interface';

@Injectable()
export class RecommendationsService {
  constructor(
    @InjectRepository(MovieHistory)
    private movieHistoryRepository: Repository<MovieHistory>,
    private openAIService: OpenAIService,
    private tmdbService: TMDbService,
    private configService: ConfigService,
  ) { }

  async getRecommendations(
    userId: string,
    recommendDto: RecommendDto,
  ): Promise<Movie[]> {
    // Retrieve user's movie history
    const movieHistory = await this.movieHistoryRepository.find({
      where: { userId },
      order: { shownAt: 'DESC' },
      take: 20, // Get last 20 movies for context
    });

    // Filter for movies to avoid: only those marked as watched OR not interested
    const moviesToAvoid = movieHistory.filter(
      (h) => h.isWatched === true || h.isNotInterested === true,
    );

    // Fetch titles for excluded IDs if provided
    const excludedTitles: string[] = [];
    if (recommendDto.excludeIds && recommendDto.excludeIds.length > 0) {
      for (const movieId of recommendDto.excludeIds) {
        try {
          // Try to get title from movie_history first
          const historyEntry = await this.movieHistoryRepository.findOne({
            where: { userId, movieId },
          });
          
          if (historyEntry) {
            excludedTitles.push(historyEntry.title);
          } else {
            // If not in history, fetch from TMDb
            const apiKey = this.configService.get<string>('TMDB_API_KEY');
            const baseUrl = this.configService.get<string>('TMDB_BASE_URL') || 'https://api.themoviedb.org/3';
            const response = await axios.get(`${baseUrl}/movie/${movieId}`, {
              params: {
                api_key: apiKey,
                language: 'ru-RU',
              },
            });
            if (response.data && response.data.title) {
              excludedTitles.push(response.data.title);
            }
          }
        } catch (error) {
          console.error(`Error fetching title for movieId ${movieId}:`, error);
          // Continue even if one fails
        }
      }
    }

    // Combine permanent avoidance list with excluded titles
    const allAvoidedTitles = [
      ...moviesToAvoid.map((h) => h.title),
      ...excludedTitles,
    ];

    // Build viewing history string for prompt
    const historyString =
      allAvoidedTitles.length > 0
        ? allAvoidedTitles.join(', ')
        : 'No viewing history';

    // Construct the prompt for OpenAI
    let prompt = `You are a professional movie recommendation expert. Your task is to recommend exactly 3 movies that PRECISELY match the user's specific preferences. DO NOT recommend random movies.

User's SPECIFIC preferences (ALL must be considered):
- Watching context: ${recommendDto.context}
- Desired moods/emotions: ${recommendDto.moods.join(', ')} - MUST match these moods
- Preferred atmosphere/plot motifs: ${recommendDto.tags.join(', ')} - MUST match these themes
- Format preference: ${recommendDto.format}`;

    if (recommendDto.similarTo) {
      prompt += `\n- Similar to: "${recommendDto.similarTo}" - Find movies with similar style, themes, or genre`;
    }

    prompt += `\n\nUser's viewing history (AVOID these): ${historyString}`;

    prompt += `\n\nCRITICAL REQUIREMENTS:
1. Each recommended movie MUST directly match the user's moods (${recommendDto.moods.join(', ')})
2. Each recommended movie MUST align with the atmosphere/themes (${recommendDto.tags.join(', ')})
3. Each recommended movie MUST fit the watching context (${recommendDto.context})
4. Respect the format preference: ${recommendDto.format}
5. If similar movie is provided, recommendations MUST have similar characteristics
6. DO NOT recommend random popular movies - they must match ALL criteria above
7. DO NOT recommend movies from the user's viewing history
8. Each movie should have a clear connection to the user's preferences
9. Ensure diversity while maintaining relevance to preferences
10. Prioritize movies available on major streaming platforms

Return ONLY a JSON object with a "recommendations" array containing exactly 3 objects, each with "title", "year", and "reason" keys. The "reason" MUST be a specific sentence (in Russian) explaining HOW this movie matches the user's selected moods and themes. Use exact movie title as in TMDb database.

Example format:
{
  "recommendations": [
    {"title": "Inception", "year": 2010, "reason": "Захватывающий сюжет идеально подходит для выбранного настроения, визуальные эффекты соответствуют предпочтениям."},
    {"title": "The Matrix", "year": 1999, "reason": "Философская атмосфера и киберпанк тематика точно соответствуют вашим предпочтениям."},
    {"title": "Interstellar", "year": 2014, "reason": "Эмоциональная глубина и космическая тематика идеально совпадают с выбранными тегами."}
  ]
}`;

    // Log the full prompt for debugging
    console.log('[OpenAI] Full prompt being sent:');
    console.log('=====================================');
    console.log(prompt);
    console.log('=====================================');

    // Get recommendations from OpenAI
    const openaiRecommendations =
      await this.openAIService.getRecommendations(prompt);

    // Fetch movie details from TMDb for each recommendation
    const movies: Movie[] = [];

    for (const rec of openaiRecommendations) {
      console.log(`[OpenAI] Processing recommendation: ${rec.title} (${rec.year})`);
      const tmdbMovie = await this.tmdbService.searchMovie(rec.title, rec.year);

      if (tmdbMovie) {
        console.log(`[TMDb] Movie found:`, {
          id: tmdbMovie.movieId,
          title: tmdbMovie.title,
          genres: tmdbMovie.genres,
          year: tmdbMovie.releaseYear,
        });

        // Fetch trailer
        const trailerKey = await this.tmdbService.getMovieVideos(tmdbMovie.movieId);
        if (trailerKey) {
          console.log(`[TMDb] Trailer found: ${trailerKey}`);
        }

        // Save to movie history without rating/feedback
        const savedHistory = await this.movieHistoryRepository.save({
          userId,
          movieId: tmdbMovie.movieId,
          title: tmdbMovie.title,
          posterPath: tmdbMovie.posterPath,
          shownAt: new Date(),
        });

        movies.push({
          movieId: tmdbMovie.movieId,
          title: tmdbMovie.title,
          posterPath: tmdbMovie.posterPath,
          reason: rec.reason,
          trailerKey: trailerKey || undefined,
          genres: tmdbMovie.genres,
          releaseYear: tmdbMovie.releaseYear,
          historyId: savedHistory.id,
          isWatched: savedHistory.isWatched,
          isNotInterested: savedHistory.isNotInterested,
        });
      } else {
        console.warn(`[TMDb] Movie not found: ${rec.title}`);
      }
    }

    // If we couldn't find all movies, try without year constraint
    if (movies.length < 3) {
      for (const rec of openaiRecommendations) {
        // Skip if already added
        if (movies.find((m) => m.title.toLowerCase() === rec.title.toLowerCase())) {
          continue;
        }

        console.log(`[OpenAI] Processing fallback recommendation: ${rec.title}`);
        const tmdbMovie = await this.tmdbService.searchMovie(rec.title);

        if (tmdbMovie) {
          // Fetch trailer
          const trailerKey = await this.tmdbService.getMovieVideos(tmdbMovie.movieId);

          // Save to movie history without rating/feedback
          const savedHistory = await this.movieHistoryRepository.save({
            userId,
            movieId: tmdbMovie.movieId,
            title: tmdbMovie.title,
            posterPath: tmdbMovie.posterPath,
            shownAt: new Date(),
          });

          movies.push({
            movieId: tmdbMovie.movieId,
            title: tmdbMovie.title,
            posterPath: tmdbMovie.posterPath,
            reason: rec.reason,
            trailerKey: trailerKey || undefined,
            genres: tmdbMovie.genres,
            releaseYear: tmdbMovie.releaseYear,
            historyId: savedHistory.id,
            isWatched: savedHistory.isWatched,
            isNotInterested: savedHistory.isNotInterested,
          });
        } else {
          console.warn(`[TMDb] Movie not found (fallback): ${rec.title}`);
        }

        if (movies.length >= 3) break;
      }
    }

    if (movies.length === 0) {
      throw new HttpException(
        'Could not find matching movies. Please try again with different preferences.',
        HttpStatus.NOT_FOUND,
      );
    }

    return movies.slice(0, 3); // Return exactly 3 movies (or fewer if not all found)
  }

  async getMovieDetails(userId: string, movieId: string): Promise<Movie> {
    try {
      // Get movie details from TMDb API directly
      const apiKey = this.configService.get<string>('TMDB_API_KEY');
      const baseUrl = this.configService.get<string>('TMDB_BASE_URL') || 'https://api.themoviedb.org/3';
      
      const response = await axios.get(`${baseUrl}/movie/${movieId}`, {
        params: {
          api_key: apiKey,
          language: 'ru-RU',
        },
      });

      const movieInfo = {
        movieId: response.data.id.toString(),
        title: response.data.title,
        posterPath: response.data.poster_path
          ? `https://image.tmdb.org/t/p/w500${response.data.poster_path}`
          : '',
        genres: response.data.genres?.map((g: any) => g.name) || [],
        releaseYear: response.data.release_date ? response.data.release_date.split('-')[0] : '',
      };

      // Get trailer
      const trailerKey = await this.tmdbService.getMovieVideos(movieId);

      // Check if movie is in history
      const history = await this.movieHistoryRepository.findOne({
        where: { userId, movieId },
        order: { shownAt: 'DESC' },
      });

      return {
        movieId: movieInfo.movieId,
        title: movieInfo.title,
        posterPath: movieInfo.posterPath,
        genres: movieInfo.genres,
        releaseYear: movieInfo.releaseYear,
        trailerKey: trailerKey || undefined,
        historyId: history?.id,
        isWatched: history?.isWatched || false,
        isNotInterested: history?.isNotInterested || false,
      };
    } catch (error) {
      console.error(`[TMDb] Error fetching movie ${movieId}:`, error);
      throw new HttpException(
        'Movie not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }
}

