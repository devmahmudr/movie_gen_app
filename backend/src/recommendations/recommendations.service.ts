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
    // Retrieve ALL user's movie history to get all rated/watched/not interested movies
    // We need ALL of them, not just last 20, to properly exclude rated movies
    const movieHistory = await this.movieHistoryRepository.find({
      where: { userId },
      order: { shownAt: 'DESC' },
    });

    // Filter for movies to avoid: those marked as watched, not interested, OR rated
    const moviesToAvoid = movieHistory.filter(
      (h) => h.isWatched === true || h.isNotInterested === true || h.userRating !== null,
    );
    
    // Create a Set of movieIds to avoid for faster lookup during processing
    const avoidedMovieIds = new Set(moviesToAvoid.map((h) => h.movieId));

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

    // Initialize tracking variables
    const movies: Movie[] = [];
    const excludeIdsSet = new Set(recommendDto.excludeIds || []);
    const failedTitles = new Set<string>();
    const maxAttempts = 5; // Increased from 3 to 5 for better reliability
    let attemptCount = 0;

    // Helper function to build dynamic prompt
    const buildPrompt = (moviesNeeded: number, currentFailedTitles: Set<string>, alreadyFoundTitles: string[]): string => {
      // Build dynamic AVOID list: watched/not interested + excluded titles + already found + failed titles
      const allAvoidedTitles = [
        ...moviesToAvoid.map((h) => h.title),
        ...excludedTitles,
        ...alreadyFoundTitles,
        ...Array.from(currentFailedTitles),
      ];

      const historyString =
        allAvoidedTitles.length > 0
          ? allAvoidedTitles.join(', ')
          : 'No viewing history';

      const isGeneratingMore = recommendDto.excludeIds && recommendDto.excludeIds.length > 0;
      // Request more movies upfront to process in parallel (8-10 movies, process all at once, take first 3 successful)
      const requestCount = Math.max(moviesNeeded * 3, 8); // Request 8-10 movies to process in parallel
      const movieCountInstruction = moviesNeeded === 3
        ? (isGeneratingMore ? 'recommend 3 NEW movies (different from previously shown ones)' : 'recommend exactly 3 movies')
        : `recommend ${requestCount} movies (you previously suggested movies that could not be found, so provide ${requestCount} NEW different movies as backups)`;
      
      let prompt = `You are a professional movie recommendation expert. Your task is to ${movieCountInstruction} that PRECISELY match the user's specific preferences. DO NOT recommend random movies.

CRITICAL: Use EXACT English titles as they appear in TMDb (The Movie Database). If a movie has a Russian title, you MUST still use its English title from TMDb. For example, use "Zombieland: Double Tap" NOT "Зомбилэнд: Контрольный выстрел". Search TMDb mentally to ensure the title exists exactly as written.

User's SPECIFIC preferences (ALL 4 answers must be considered):
1. Watching context: ${recommendDto.context}
2. Desired moods/emotions: ${recommendDto.moods.join(', ')} - MUST match these moods
3. Preferred atmosphere/plot motifs: ${recommendDto.tags.join(', ')} - MUST match these themes (these tags are contextually linked to the user's selected moods)
4. Format preference: ${recommendDto.format}`;

      if (recommendDto.format === 'Мультфильм') {
        prompt += `\n- CRITICAL FORMAT REQUIREMENT: The user has selected "Мультфильм" (Cartoon/Animated). ALL recommendations MUST be animated films or animated series. DO NOT recommend live-action content. Only animated/cartoon content is acceptable.`;
      }

      // CRITICAL: The 4th question (similarTo) is VERY IMPORTANT - check if it aligns with Q2/Q3
      if (recommendDto.similarTo && recommendDto.similarTo.trim()) {
        // Check if similarTo logically aligns with moods and tags
        // If it doesn't align, prioritize similarTo over Q2/Q3
        const similarToLower = recommendDto.similarTo.toLowerCase();
        const moodsString = recommendDto.moods.join(' ').toLowerCase();
        const tagsString = recommendDto.tags.join(' ').toLowerCase();
        
        // Simple heuristic: if similarTo mentions something that doesn't match moods/tags, prioritize it
        const hasConflict = !similarToLower.includes(moodsString) && 
                           !similarToLower.includes(tagsString) &&
                           !moodsString.includes(similarToLower) &&
                           !tagsString.includes(similarToLower);
        
        if (hasConflict) {
          // Q4 doesn't align with Q2/Q3 - prioritize Q4
          prompt += `\n\n5. CRITICAL USER REQUEST - SIMILAR MOVIE DESCRIPTION: "${recommendDto.similarTo}"
IMPORTANT: The user's explicit description does not align with their previous mood/tag selections. In this case, you MUST prioritize this description over the previous answers (moods and tags). Find movies that match this description closely, similar to the example provided. This is the PRIMARY requirement - the user wants something specific like "${recommendDto.similarTo}".`;
        } else {
          // Q4 aligns with Q2/Q3 - use all together
          prompt += `\n\n5. CRITICAL USER REQUEST - SIMILAR MOVIE DESCRIPTION: "${recommendDto.similarTo}"
This is the user's explicit description of what kind of movie they want. You MUST prioritize this requirement along with the moods and tags. Find movies that match this description closely while also considering the selected moods and tags. This is not optional - it is a direct request from the user about the movie's plot, theme, or content.`;
        }
      } else {
        prompt += `\n\n5. Additional preferences: None specified`;
      }

      prompt += `\n\nAVOID these movies (DO NOT recommend any of these): ${historyString}`;

      // Note: excludedTitles (from excludeIds) are already included in historyString above
      // We don't need to add IDs separately since OpenAI only works with titles, not IDs

      if (currentFailedTitles.size > 0) {
        prompt += `\n\nCRITICAL: The following movie titles could not be found in the database and MUST NOT be recommended again: ${Array.from(currentFailedTitles).join(', ')}.`;
      }

      if (alreadyFoundTitles.length > 0) {
        prompt += `\n\nNOTE: The following movies have already been successfully found and should NOT be recommended: ${alreadyFoundTitles.join(', ')}.`;
      }

      const formatRequirement = recommendDto.format === 'Мультфильм' 
        ? `4. FORMAT IS CRITICAL: All recommendations MUST be animated films or animated series (cartoons). NO live-action content allowed.`
        : `4. Respect the format preference: ${recommendDto.format}`;

      const flexibilityNote = isGeneratingMore 
        ? '\nNOTE: Since the user is requesting additional recommendations, you may be slightly more flexible with matching criteria while still maintaining relevance to the core preferences. The goal is to find NEW movies that the user hasn\'t seen yet.'
        : '';

      prompt += `\n\nREQUIREMENTS:
1. Match moods: ${recommendDto.moods.join(', ')}
2. Match themes: ${recommendDto.tags.join(', ')}
3. Context: ${recommendDto.context}
${formatRequirement}`;

      // Emphasize similarTo requirement more strongly
      if (recommendDto.similarTo && recommendDto.similarTo.trim()) {
        const similarToLower = recommendDto.similarTo.toLowerCase();
        const moodsString = recommendDto.moods.join(' ').toLowerCase();
        const tagsString = recommendDto.tags.join(' ').toLowerCase();
        const hasConflict = !similarToLower.includes(moodsString) && 
                           !similarToLower.includes(tagsString) &&
                           !moodsString.includes(similarToLower) &&
                           !tagsString.includes(similarToLower);
        
        if (hasConflict) {
          prompt += `\n5. CRITICAL - SIMILAR MOVIE REQUIREMENT (PRIORITY OVER Q2/Q3): The user explicitly requested: "${recommendDto.similarTo}". Since this does not align with the previous mood/tag selections, you MUST prioritize this description. Each recommended movie MUST match this description closely (e.g., if user wants "something like Harry Potter", recommend fantasy/magic movies similar to Harry Potter, regardless of the previous mood/tag selections). This is the PRIMARY requirement.`;
        } else {
          prompt += `\n5. CRITICAL - SIMILAR MOVIE REQUIREMENT: The user explicitly requested: "${recommendDto.similarTo}". This is REQUIRED and MUST be prioritized along with moods and tags. Each recommended movie MUST match this description closely in terms of plot, theme, setting, or story elements. This is the 4th answer from the user and is MANDATORY to consider.`;
        }
      } else {
        prompt += `\n5. Similar movie preference: Not specified (user skipped this question)`;
      }

      prompt += `
Rules: Match ALL criteria. Avoid AVOID list. Ensure diversity. Use exact TMDb titles.${flexibilityNote}

Return ONLY a JSON object with a "recommendations" array containing exactly ${requestCount} objects, each with "title", "year", and "reason" keys. The "reason" MUST be a specific sentence (in Russian) explaining HOW this movie matches the user's selected moods and themes. 

CRITICAL TITLE REQUIREMENT: Use EXACT English titles as they appear in TMDb database. DO NOT use Russian translations. For example:
- Use "Zombieland: Double Tap" NOT "Зомбилэнд: Контрольный выстрел"
- Use "The Matrix" NOT "Матрица"
- Use "Inception" NOT "Начало"

Verify the title exists in TMDb before recommending.

Example format:
{
  "recommendations": [
    {"title": "Inception", "year": 2010, "reason": "Захватывающий сюжет идеально подходит для выбранного настроения, визуальные эффекты соответствуют предпочтениям."},
    {"title": "The Matrix", "year": 1999, "reason": "Философская атмосфера и киберпанк тематика точно соответствуют вашим предпочтениям."},
    {"title": "Interstellar", "year": 2014, "reason": "Эмоциональная глубина и космическая тематика идеально совпадают с выбранными тегами."}
  ]
}`;

      return prompt;
    };

    // Helper function to process a single recommendation
    const processRecommendation = async (rec: any): Promise<boolean> => {
      console.log(`[OpenAI] Processing recommendation: ${rec.title} (${rec.year || 'no year'})`);
      
      // First try with year
      let tmdbMovie = await this.tmdbService.searchMovie(rec.title, rec.year, language);
      
      // If not found, try without year constraint
      if (!tmdbMovie) {
        console.log(`[TMDb] Movie not found with year, trying without year: ${rec.title}`);
        tmdbMovie = await this.tmdbService.searchMovie(rec.title, undefined, language);
      }

      if (!tmdbMovie) {
        console.warn(`[TMDb] Movie not found: ${rec.title}`);
        failedTitles.add(rec.title);
        return false;
      }

      // Skip if this movie is in the exclude list
      if (excludeIdsSet.has(tmdbMovie.movieId)) {
        console.log(`[TMDb] Skipping excluded movie: ${tmdbMovie.title} (ID: ${tmdbMovie.movieId})`);
        failedTitles.add(rec.title);
        return false;
      }

      // CRITICAL: Check if user has already rated, watched, or marked as not interested this movie
      // First check the Set for fast lookup, then verify with database query
      if (avoidedMovieIds.has(tmdbMovie.movieId)) {
        const existingHistory = await this.movieHistoryRepository.findOne({
          where: { 
            userId, 
            movieId: tmdbMovie.movieId 
          },
        });

        if (existingHistory && (existingHistory.userRating !== null || existingHistory.isWatched === true || existingHistory.isNotInterested === true)) {
          console.log(`[TMDb] Skipping movie (rated/watched/not interested): ${tmdbMovie.title} (ID: ${tmdbMovie.movieId}, rating: ${existingHistory.userRating}, watched: ${existingHistory.isWatched}, notInterested: ${existingHistory.isNotInterested})`);
          failedTitles.add(rec.title);
          return false;
        }
      }

      // Check if already added (by movieId or title)
      if (movies.find((m) => m.movieId === tmdbMovie.movieId || m.title.toLowerCase() === tmdbMovie.title.toLowerCase())) {
        console.log(`[TMDb] Movie already in results, skipping: ${tmdbMovie.title}`);
        failedTitles.add(rec.title);
        return false;
      }

      console.log(`[TMDb] Movie found:`, {
        id: tmdbMovie.movieId,
        title: tmdbMovie.title,
        genres: tmdbMovie.genres,
        year: tmdbMovie.releaseYear,
      });

      // OPTIMIZATION: Fetch trailer from both sources in parallel (non-blocking, timeout after 2 seconds)
      // This significantly speeds up processing - trailers are optional, movies are not
      let trailerKey: string | null = null;
      const trailerPromise = (async () => {
        try {
          // Get both Russian and English titles for YouTube search
          const movieTitles = await this.tmdbService.getMovieTitles(tmdbMovie.movieId);
          const titleRu = movieTitles?.titleRu || tmdbMovie.title;
          const titleEn = movieTitles?.titleEn || tmdbMovie.title;
          
          // Extract interface language (ru-RU -> ru, en-US -> en, etc.)
          const interfaceLanguage = language.split('-')[0].toLowerCase();
          
          // Fetch from both sources in parallel with timeout
          const [youtubeResult, tmdbResult] = await Promise.allSettled([
            this.tmdbService.searchTrailerOnYouTube(titleRu, titleEn, interfaceLanguage),
            this.tmdbService.getMovieVideos(tmdbMovie.movieId, language),
          ]);
          
          // Use YouTube first if available, otherwise TMDb
          if (youtubeResult.status === 'fulfilled' && youtubeResult.value) {
            trailerKey = youtubeResult.value;
            console.log(`[YouTube] Trailer found from YouTube for ${tmdbMovie.title}`);
          } else if (tmdbResult.status === 'fulfilled' && tmdbResult.value) {
            trailerKey = tmdbResult.value;
            console.log(`[TMDb] Trailer found from TMDb videos API for ${tmdbMovie.title}`);
          }
        } catch (error) {
          // Silently fail - trailers are optional
          console.log(`[Trailer] Could not fetch trailer for ${tmdbMovie.title}`);
        }
      })();
      
      // Set timeout for trailer fetching (2 seconds max, don't block movie processing)
      const trailerTimeout = new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 2000);
      });
      
      await Promise.race([trailerPromise, trailerTimeout]);

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
        userRating: savedHistory.userRating || null,
        overview: tmdbMovie.overview,
        country: tmdbMovie.country,
        imdbRating: tmdbMovie.imdbRating,
        runtime: tmdbMovie.runtime,
        ageRating: tmdbMovie.ageRating,
      });

      return true;
    };

    // Main while loop: Continue until we have 3 movies or max attempts reached
    while (movies.length < 3 && attemptCount < maxAttempts) {
      attemptCount++;
      const moviesNeeded = 3 - movies.length;
      const alreadyFoundTitles = movies.map((m) => m.title);

      console.log(`[Recommendations] Attempt ${attemptCount}/${maxAttempts}: Need ${moviesNeeded} more movie(s), currently have ${movies.length} movies`);
      if (failedTitles.size > 0) {
        console.log(`[Recommendations] Failed titles from previous attempts: ${Array.from(failedTitles).join(', ')}`);
      }

      // Build dynamic prompt with current state
      const prompt = buildPrompt(moviesNeeded, failedTitles, alreadyFoundTitles);
      
      // Calculate how many we'll request (for logging)
      const requestCount = Math.max(moviesNeeded + 2, 3);
      console.log(`[Recommendations] Requesting ${requestCount} movies from OpenAI (need ${moviesNeeded}, requesting ${requestCount} for backup options)`);

      // Log the prompt for debugging (only first attempt or if retrying)
      if (attemptCount === 1 || failedTitles.size > 0) {
        console.log('[OpenAI] Full prompt being sent:');
        console.log('=====================================');
        console.log(prompt);
        console.log('=====================================');
      }

      try {
        // Get recommendations from OpenAI (request more than needed for backups)
        let openaiRecommendations;
        try {
          openaiRecommendations = await this.openAIService.getRecommendations(prompt);
        } catch (openaiError: any) {
          console.error(`[OpenAI] Service error on attempt ${attemptCount}:`, openaiError);
          // If OpenAI fails, wait and retry instead of immediately failing
          if (attemptCount < maxAttempts) {
            console.log(`[Recommendations] OpenAI error, will retry on next attempt...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue; // Skip to next iteration
          }
          throw openaiError; // Only throw if we've exhausted all attempts
        }

        // Process recommendations in parallel with TRUE EARLY EXIT - return immediately when 3 movies found
        const maxParallel = 8;
        const recommendationsToProcess = openaiRecommendations.slice(0, maxParallel);
        const moviesNeeded = 3 - movies.length;
        
        console.log(`[Recommendations] Processing ${recommendationsToProcess.length} recommendations in parallel (need ${moviesNeeded} more)...`);
        
        let successfulCount = 0;
        let failedCount = 0;
        let completedCount = 0;
        const startTime = Date.now();
        let shouldStop = false;
        let checkInterval: NodeJS.Timeout | null = null;
        
        // Create a promise that resolves when we have 3 movies (for early exit)
        const earlyExitPromise = new Promise<void>((resolve) => {
          checkInterval = setInterval(() => {
            if (movies.length >= 3 || shouldStop) {
              if (checkInterval) {
                clearInterval(checkInterval);
                checkInterval = null;
              }
              resolve();
            }
          }, 10); // Check every 10ms
        });
        
        // Process all recommendations in parallel
        const processingPromises = recommendationsToProcess.map(async (rec, index) => {
          try {
            const success = await processRecommendation(rec);
            completedCount++;
            
            if (success) {
              successfulCount++;
              // Check if we should stop (have 3 movies) - check immediately after push
              if (movies.length >= 3 && !shouldStop) {
                shouldStop = true;
                if (checkInterval) {
                  clearInterval(checkInterval);
                  checkInterval = null;
                }
                const elapsed = Date.now() - startTime;
                console.log(`[Recommendations] ✓ Early exit: Found 3 movies in ${elapsed}ms. Processed ${completedCount}/${recommendationsToProcess.length}. Remaining ${recommendationsToProcess.length - completedCount} will continue in background.`);
              }
            } else {
              failedCount++;
            }
            
            return { success, index };
          } catch (error) {
            completedCount++;
            failedCount++;
            console.error(`[Recommendations] Error processing recommendation ${index + 1}:`, error);
            return { success: false, index };
          }
        });
        
        try {
          // Race between early exit (when we have 3 movies) and all processing completing
          await Promise.race([
            earlyExitPromise,
            Promise.allSettled(processingPromises).then(() => {
              shouldStop = true;
              if (checkInterval) {
                clearInterval(checkInterval);
                checkInterval = null;
              }
            }),
          ]);
        } finally {
          // Ensure interval is always cleaned up
          if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
          }
        }
        
        const elapsed = Date.now() - startTime;
        const actuallyProcessed = completedCount;
        console.log(`[Recommendations] Processing complete: ${successfulCount} successful, ${failedCount} failed, ${actuallyProcessed} processed in ${elapsed}ms. Total movies: ${movies.length}/3`);

        // If we still need more movies, wait a bit before retrying to avoid rate limits
        if (movies.length < 3 && attemptCount < maxAttempts) {
          console.log(`[Recommendations] Only found ${movies.length} movies. Retrying... (failed titles: ${Array.from(failedTitles).join(', ') || 'none'})`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`[OpenAI] Error on attempt ${attemptCount}:`, error);
        // Don't throw immediately - allow retries even on first attempt
        // Only throw if we've exhausted all attempts and have no movies
        if (attemptCount >= maxAttempts) {
          // If we have some movies, return them instead of throwing
          if (movies.length > 0) {
            console.warn(`[Recommendations] Reached max attempts (${maxAttempts}) but have ${movies.length} movie(s). Returning partial results.`);
            break;
          }
          // Only throw if we have absolutely no movies after all retries
          throw error;
        }
        // Wait before retrying to avoid rate limits
        console.log(`[Recommendations] Waiting before retry attempt ${attemptCount + 1}...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Increased wait time
      }
    }

    // Validate final result - be more lenient, allow partial results
    if (movies.length === 0) {
      const hasExclusions = recommendDto.excludeIds && recommendDto.excludeIds.length > 0;
      const errorMessage = hasExclusions
        ? 'Could not find additional matching movies. All recommendations may have already been shown. Please try again with different preferences.'
        : 'Could not find matching movies. Please try again with different preferences.';
      
      throw new HttpException(
        errorMessage,
        HttpStatus.NOT_FOUND,
      );
    }

    // Log final result - accept partial results (1-2 movies) instead of failing
    if (movies.length < 3) {
      console.warn(`[Recommendations] WARNING: Only returning ${movies.length} movie(s) after ${attemptCount} attempts (requested 3). This is acceptable - returning partial results.`);
    } else {
      console.log(`[Recommendations] Successfully returning ${movies.length} movie(s) (requested 3)`);
    }

    // Return movies array sliced to maximum of 3
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
          append_to_response: 'external_ids,release_dates',
        },
      });

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
        runtime: response.data.runtime || undefined,
        ageRating: ageRating,
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

      // PRIMARY: Search for trailer on YouTube first (respects interface language, better for Russian trailers)
      let trailerKey: string | null = null;
      try {
        // Get both Russian and English titles for YouTube search
        const movieTitles = await this.tmdbService.getMovieTitles(movieId);
        const titleRu = movieTitles?.titleRu || movieInfo.title;
        const titleEn = movieTitles?.titleEn || movieInfo.title;
        
        // Extract interface language (ru-RU -> ru, en-US -> en, etc.)
        const interfaceLanguage = language.split('-')[0].toLowerCase();
        
        // Search for trailer on YouTube with interface language preference
        trailerKey = await this.tmdbService.searchTrailerOnYouTube(
          titleRu,
          titleEn,
          interfaceLanguage,
        );
        if (trailerKey) {
          console.log(`[YouTube] Trailer found from YouTube for ${movieId} in language ${interfaceLanguage}`);
        }
      } catch (youtubeError) {
        console.log(`[YouTube] Could not find trailer on YouTube for ${movieId}:`, youtubeError.message);
      }
      
      // FALLBACK: If no trailer from YouTube, try TMDb videos endpoint (respects language parameter)
      if (!trailerKey) {
        try {
          trailerKey = await this.tmdbService.getMovieVideos(movieId, language);
          if (trailerKey) {
            console.log(`[TMDb] Trailer found from TMDb videos API (fallback) for ${movieId} in language ${language}`);
          }
        } catch (videoError) {
          console.log(`[TMDb] Could not fetch trailer from TMDb videos for ${movieId}:`, videoError.message);
        }
      }

      // Check if movie is in history
      const history = await this.movieHistoryRepository.findOne({
        where: { userId, movieId },
        order: { shownAt: 'DESC' },
      });

      // Calculate public rating (average rating from all users for this movie)
      const allRatings = await this.movieHistoryRepository.find({
        where: { movieId },
        select: ['userRating'],
      });
      const validRatings = allRatings
        .map(h => h.userRating)
        .filter((rating): rating is number => rating !== null && rating !== undefined);
      const publicRating = validRatings.length > 0
        ? validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length
        : undefined;

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
        userRating: history?.userRating || null,
        publicRating: publicRating ? Number(publicRating.toFixed(1)) : undefined,
        overview: movieInfo.overview,
        country: movieInfo.country,
        imdbRating,
        runtime: movieInfo.runtime,
        ageRating: movieInfo.ageRating,
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

