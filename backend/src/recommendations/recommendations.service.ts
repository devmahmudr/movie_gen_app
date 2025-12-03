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
    // Get language preference (default to ru-RU)
    const language = recommendDto.language || 'ru-RU';
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
    const isGeneratingMore = recommendDto.excludeIds && recommendDto.excludeIds.length > 0;
    const movieCountInstruction = isGeneratingMore 
      ? 'recommend 3 NEW movies (different from previously shown ones)' 
      : 'recommend exactly 3 movies';
    
    let prompt = `You are a professional movie recommendation expert. Your task is to ${movieCountInstruction} that PRECISELY match the user's specific preferences. DO NOT recommend random movies.

User's SPECIFIC preferences (ALL must be considered):
- Watching context: ${recommendDto.context}
- Desired moods/emotions: ${recommendDto.moods.join(', ')} - MUST match these moods
- Preferred atmosphere/plot motifs: ${recommendDto.tags.join(', ')} - MUST match these themes (these tags are contextually linked to the user's selected moods)
- Format preference: ${recommendDto.format}`;

    if (recommendDto.format === 'Мультфильм') {
      prompt += `\n- CRITICAL FORMAT REQUIREMENT: The user has selected "Мультфильм" (Cartoon/Animated). ALL 3 recommendations MUST be animated films or animated series. DO NOT recommend live-action content. Only animated/cartoon content is acceptable.`;
    }

    if (recommendDto.similarTo) {
      prompt += `\n- Similar to: "${recommendDto.similarTo}" - Find movies with similar style, themes, or genre`;
    }

    prompt += `\n\nUser's viewing history (AVOID these): ${historyString}`;

    // Add excluded IDs to the prompt if provided
    if (recommendDto.excludeIds && recommendDto.excludeIds.length > 0) {
      prompt += `\n\nIMPORTANT: The following movie IDs have already been shown to the user and MUST be excluded: ${recommendDto.excludeIds.join(', ')}. DO NOT recommend these movies again.`;
    }

    const formatRequirement = recommendDto.format === 'Мультфильм' 
      ? `4. FORMAT IS CRITICAL: All recommendations MUST be animated films or animated series (cartoons). NO live-action content allowed.`
      : `4. Respect the format preference: ${recommendDto.format}`;

    const flexibilityNote = isGeneratingMore 
      ? '\nNOTE: Since the user is requesting additional recommendations, you may be slightly more flexible with matching criteria while still maintaining relevance to the core preferences. The goal is to find NEW movies that the user hasn\'t seen yet.'
      : '';

    prompt += `\n\nCRITICAL REQUIREMENTS:
1. Each recommended movie MUST directly match the user's moods (${recommendDto.moods.join(', ')})
2. Each recommended movie MUST align with the atmosphere/themes (${recommendDto.tags.join(', ')})
3. Each recommended movie MUST fit the watching context (${recommendDto.context})
${formatRequirement}
5. If similar movie is provided, recommendations MUST have similar characteristics
6. DO NOT recommend random popular movies - they must match ALL criteria above
7. DO NOT recommend movies from the user's viewing history
${recommendDto.excludeIds && recommendDto.excludeIds.length > 0 ? '8. DO NOT recommend movies with IDs that have already been shown (see excluded IDs above)' : '8. Each movie should have a clear connection to the user\'s preferences'}
9. Each movie should have a clear connection to the user's preferences
10. Ensure diversity while maintaining relevance to preferences
11. Prioritize movies available on major streaming platforms
12. If you cannot find 3 perfect matches, provide the best available alternatives that still match the core preferences${flexibilityNote}

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
    const excludeIdsSet = new Set(recommendDto.excludeIds || []);

    for (const rec of openaiRecommendations) {
      console.log(`[OpenAI] Processing recommendation: ${rec.title} (${rec.year})`);
      const tmdbMovie = await this.tmdbService.searchMovie(rec.title, rec.year, language);

      if (tmdbMovie) {
        // Skip if this movie is in the exclude list
        if (excludeIdsSet.has(tmdbMovie.movieId)) {
          console.log(`[TMDb] Skipping excluded movie: ${tmdbMovie.title} (ID: ${tmdbMovie.movieId})`);
          continue;
        }

        console.log(`[TMDb] Movie found:`, {
          id: tmdbMovie.movieId,
          title: tmdbMovie.title,
          genres: tmdbMovie.genres,
          year: tmdbMovie.releaseYear,
        });

        // Fetch trailer
        const trailerKey = await this.tmdbService.getMovieVideos(tmdbMovie.movieId, language);
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
          overview: tmdbMovie.overview,
          country: tmdbMovie.country,
          imdbRating: tmdbMovie.imdbRating,
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
        const tmdbMovie = await this.tmdbService.searchMovie(rec.title, undefined, language);

        if (tmdbMovie) {
          // Skip if this movie is in the exclude list
          if (excludeIdsSet.has(tmdbMovie.movieId)) {
            console.log(`[TMDb] Skipping excluded movie (fallback): ${tmdbMovie.title} (ID: ${tmdbMovie.movieId})`);
            continue;
          }

          // Fetch trailer
          const trailerKey = await this.tmdbService.getMovieVideos(tmdbMovie.movieId, language);

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
            overview: tmdbMovie.overview,
            country: tmdbMovie.country,
            imdbRating: tmdbMovie.imdbRating,
          });
        } else {
          console.warn(`[TMDb] Movie not found (fallback): ${rec.title}`);
        }

        if (movies.length >= 3) break;
      }
    }

    // Return whatever movies we found (even if less than 3)
    // This allows partial results when generating more recommendations
    if (movies.length === 0) {
      // Only throw error if we have no movies at all
      // This is more lenient for "generate more" scenarios
      const hasExclusions = recommendDto.excludeIds && recommendDto.excludeIds.length > 0;
      const errorMessage = hasExclusions
        ? 'Could not find additional matching movies. All recommendations may have already been shown. Please try again with different preferences.'
        : 'Could not find matching movies. Please try again with different preferences.';
      
      throw new HttpException(
        errorMessage,
        HttpStatus.NOT_FOUND,
      );
    }

    // Return all found movies (up to 3)
    // For "generate more" scenarios, we accept partial results
    console.log(`[Recommendations] Returning ${movies.length} movie(s) (requested 3)`);
    return movies.slice(0, 3);
  }

  async getMovieDetails(userId: string, movieId: string, language: string = 'ru-RU'): Promise<Movie> {
    try {
      // Get movie details from TMDb API directly
      const apiKey = this.configService.get<string>('TMDB_API_KEY');
      const baseUrl = this.configService.get<string>('TMDB_BASE_URL') || 'https://api.themoviedb.org/3';
      
      const response = await axios.get(`${baseUrl}/movie/${movieId}`, {
        params: {
          api_key: apiKey,
          language: language,
          append_to_response: 'external_ids',
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
        overview: response.data.overview || '',
        country: response.data.production_countries?.[0]?.name || '',
      };

      // Get IMDb rating
      let imdbRating: number | undefined;
      const imdbId = response.data.external_ids?.imdb_id;
      if (imdbId) {
        try {
          const omdbResponse = await axios.get(`http://www.omdbapi.com/`, {
            params: {
              i: imdbId,
              apikey: process.env.OMDB_API_KEY || '',
            },
            timeout: 3000,
          });
          if (omdbResponse.data?.imdbRating) {
            imdbRating = parseFloat(omdbResponse.data.imdbRating);
          }
        } catch (omdbError) {
          if (response.data.vote_average) {
            imdbRating = parseFloat((response.data.vote_average * 1.111).toFixed(1));
          }
        }
      } else if (response.data.vote_average) {
        imdbRating = parseFloat((response.data.vote_average * 1.111).toFixed(1));
      }

      // Get trailer
      const trailerKey = await this.tmdbService.getMovieVideos(movieId, language);

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
        overview: movieInfo.overview,
        country: movieInfo.country,
        imdbRating,
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

