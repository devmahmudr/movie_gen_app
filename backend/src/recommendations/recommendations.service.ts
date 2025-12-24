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

    // Initialize excludeIdsSet early so it can be used in similarTo processing
    const excludeIdsSet = new Set(recommendDto.excludeIds || []);

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

    // Extract and exclude the example movie from similarTo field
    // The similarTo field is an example - results should be similar but NOT include that movie
    let exampleMovieId: string | null = null;
    let exampleMovieTitle: string | null = null;
    if (recommendDto.similarTo && recommendDto.similarTo.trim()) {
      try {
        // Try to extract movie title from similarTo text
        // It could be: "something like Harry Potter" or just "Harry Potter"
        const similarToText = recommendDto.similarTo.trim();
        
        // Common patterns: "like X", "similar to X", "X", "something like X"
        let potentialTitle = similarToText;
        const patterns = [
          /(?:like|similar to|something like|как|похож на|типа)\s+(.+)/i,
          /(.+?)(?:\s+трейлер|\s+фильм|\s+сериал)/i,
        ];
        
        for (const pattern of patterns) {
          const match = similarToText.match(pattern);
          if (match && match[1]) {
            potentialTitle = match[1].trim();
            break;
          }
        }
        
        // Try to find the movie in TMDb
        console.log(`[Recommendations] Searching for example movie from similarTo: "${potentialTitle}"`);
        const exampleMovie = await this.tmdbService.searchMovie(potentialTitle, undefined, language);
        
        if (exampleMovie) {
          exampleMovieId = exampleMovie.movieId;
          exampleMovieTitle = exampleMovie.title;
          
          // Add to exclusion sets
          excludeIdsSet.add(exampleMovieId);
          excludedTitles.push(exampleMovieTitle);
          
          console.log(`[Recommendations] Found example movie to exclude: "${exampleMovieTitle}" (ID: ${exampleMovieId})`);
        } else {
          console.log(`[Recommendations] Could not find example movie "${potentialTitle}" in TMDb, will exclude by title in prompt`);
          // If we can't find it, still add the potential title to excluded titles
          excludedTitles.push(potentialTitle);
        }
      } catch (error) {
        console.error(`[Recommendations] Error extracting example movie from similarTo:`, error);
        // Continue - we'll still mention it in the prompt
      }
    }

    // Initialize tracking variables
    const movies: Movie[] = [];
    const failedTitles = new Set<string>();
    const maxAttempts = 10; // Increased to 10 to ensure we always get 3 valid movies
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
      // Request more movies upfront to process in parallel - request at least 15 to ensure we find 3 valid ones
      const requestCount = Math.max(moviesNeeded * 5, 15); // Request 15+ movies to process in parallel
      const movieCountInstruction = moviesNeeded === 3
        ? (isGeneratingMore ? 'recommend 3 NEW movies (different from previously shown ones) that STRICTLY match ALL the same criteria' : 'recommend exactly 3 movies')
        : `recommend ${requestCount} movies (you previously suggested movies that could not be found, so provide ${requestCount} NEW different movies as backups)`;
      
      const strictnessHeader = isGeneratingMore 
        ? `You are a professional movie recommendation expert. Your task is to ${movieCountInstruction}. These are ADDITIONAL recommendations - they must match the SAME strict criteria as the original recommendations. DO NOT be flexible. DO NOT compromise on any criteria. Match ALL criteria strictly. DO NOT recommend random movies.`
        : `You are a professional movie recommendation expert. Your task is to ${movieCountInstruction} that PRECISELY match the user's specific preferences. DO NOT recommend random movies.`;
      
      let prompt = strictnessHeader + `\n\nCRITICAL: Use EXACT English titles as they appear in TMDb (The Movie Database). If a movie has a Russian title, you MUST still use its English title from TMDb. For example, use "Zombieland: Double Tap" NOT "Зомбилэнд: Контрольный выстрел". Search TMDb mentally to ensure the title exists exactly as written.

User's SPECIFIC preferences (ALL 4 answers must be considered):
1. Watching context: ${recommendDto.context}
2. Desired moods/emotions: ${recommendDto.moods.join(', ')} - MUST match these moods
3. Preferred atmosphere/plot motifs: ${recommendDto.tags.join(', ')} - MUST match these themes (these tags are contextually linked to the user's selected moods)
4. Format preference: ${recommendDto.format}`;

      if (recommendDto.format === 'Мультфильм') {
        prompt += `\n- CRITICAL FORMAT REQUIREMENT: The user has selected "Мультфильм" (Cartoon/Animated). ALL recommendations MUST be animated films or animated series. DO NOT recommend live-action content. Only animated/cartoon content is acceptable.`;
      }

      // CRITICAL: The 4th question (similarTo) is an EXAMPLE movie - results should be similar but NOT include that movie
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
        
        const exampleMovieNote = exampleMovieTitle 
          ? ` CRITICAL: The user provided "${exampleMovieTitle}" as an EXAMPLE. You MUST recommend movies SIMILAR to "${exampleMovieTitle}" but DO NOT include "${exampleMovieTitle}" itself in the recommendations.`
          : ` CRITICAL: The user provided "${recommendDto.similarTo}" as an EXAMPLE. You MUST recommend movies SIMILAR to this example but DO NOT include the example movie itself in the recommendations.`;
        
        if (hasConflict) {
          // Q4 doesn't align with Q2/Q3 - prioritize Q4
          prompt += `\n\n5. CRITICAL USER REQUEST - SIMILAR MOVIE EXAMPLE: "${recommendDto.similarTo}"
IMPORTANT: The user's explicit example does not align with their previous mood/tag selections. In this case, you MUST prioritize this example over the previous answers (moods and tags). Find movies that are SIMILAR to this example.${exampleMovieNote} This is the PRIMARY requirement - the user wants something similar to "${recommendDto.similarTo}".`;
        } else {
          // Q4 aligns with Q2/Q3 - use all together
          prompt += `\n\n5. CRITICAL USER REQUEST - SIMILAR MOVIE EXAMPLE: "${recommendDto.similarTo}"
This is the user's explicit example of what kind of movie they want. You MUST recommend movies that are SIMILAR to this example while also considering the selected moods and tags.${exampleMovieNote} This is not optional - it is a direct request from the user about the movie's plot, theme, or content.`;
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
        : recommendDto.format === 'Фильм'
        ? `4. FORMAT IS CRITICAL: All recommendations MUST be live-action films (movies). NO animated/cartoon content allowed.`
        : recommendDto.format === 'Сериал'
        ? `4. FORMAT IS CRITICAL: All recommendations MUST be TV series. NO films or cartoons allowed.`
        : `4. Respect the format preference: ${recommendDto.format}`;

      const strictnessNote = isGeneratingMore 
        ? `\n\nCRITICAL STRICTNESS REQUIREMENT FOR ADDITIONAL RECOMMENDATIONS:
The user is requesting MORE movies that match their ORIGINAL preferences. You MUST be STRICT and match ALL of the following criteria EXACTLY:
- Context: ${recommendDto.context} (MUST match)
- Moods: ${recommendDto.moods.join(', ')} (MUST match ALL)
- Tags: ${recommendDto.tags.join(', ')} (MUST match ALL)
- Format: ${recommendDto.format} (MUST match exactly)
${recommendDto.similarTo ? `- Similar to: ${recommendDto.similarTo} (MUST be similar)` : ''}

DO NOT be flexible. DO NOT compromise on any criteria. Only recommend movies that match ALL of the above requirements. The goal is to find NEW movies that match the SAME strict criteria as the original recommendations.`
        : '';

      prompt += `\n\nSTRICT REQUIREMENTS (ALL must be matched - NO exceptions):
1. Moods: ${recommendDto.moods.join(', ')} - MUST match ALL of these moods
2. Themes/Tags: ${recommendDto.tags.join(', ')} - MUST match ALL of these themes
3. Context: ${recommendDto.context} - MUST match this watching context
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
        
        const exampleExclusionNote = exampleMovieTitle 
          ? ` DO NOT recommend "${exampleMovieTitle}" itself - it is only an EXAMPLE.`
          : ` DO NOT recommend the example movie itself - it is only an EXAMPLE.`;
        
        if (hasConflict) {
          prompt += `\n5. CRITICAL - SIMILAR MOVIE EXAMPLE (PRIORITY OVER Q2/Q3): The user provided "${recommendDto.similarTo}" as an EXAMPLE. Since this does not align with the previous mood/tag selections, you MUST prioritize this example. Each recommended movie MUST be SIMILAR to this example (e.g., if user wants "something like Harry Potter", recommend fantasy/magic movies similar to Harry Potter, regardless of the previous mood/tag selections).${exampleExclusionNote} This is the PRIMARY requirement.`;
        } else {
          prompt += `\n5. CRITICAL - SIMILAR MOVIE EXAMPLE: The user provided "${recommendDto.similarTo}" as an EXAMPLE. This is REQUIRED and MUST be prioritized along with moods and tags. Each recommended movie MUST be SIMILAR to this example in terms of plot, theme, setting, or story elements.${exampleExclusionNote} This is the 4th answer from the user and is MANDATORY to consider.`;
        }
      } else {
        prompt += `\n5. Similar movie preference: Not specified (user skipped this question)`;
      }

      prompt += `
STRICT RULES (NO exceptions):
- Match ALL criteria above (moods, tags, context, format${recommendDto.similarTo ? ', similarTo' : ''})
- Avoid AVOID list (never recommend excluded movies)
- Ensure diversity (different movies from previous recommendations)
- Use exact TMDb titles only
${strictnessNote}

Return ONLY a JSON object with a "recommendations" array containing exactly ${requestCount} objects, each with "title", "year", and "reason" keys. The "reason" MUST be a specific sentence (in Russian) explaining HOW this movie matches the user's selected moods and themes. 

CRITICAL: You MUST provide exactly ${requestCount} different movie recommendations. Use well-known, popular movies that definitely exist in TMDb database. Avoid obscure or very recent movies that might not be in the database yet. Prioritize mainstream, widely-known films.

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
      
      // First try with year and format preference
      let tmdbMovie = await this.tmdbService.searchMovie(rec.title, rec.year, language, recommendDto.format);
      
      // If not found, try without year constraint but keep format preference
      if (!tmdbMovie) {
        console.log(`[TMDb] Movie not found with year, trying without year: ${rec.title}`);
        tmdbMovie = await this.tmdbService.searchMovie(rec.title, undefined, language, recommendDto.format);
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

      // VALIDATION: Check if movie has all required data before proceeding
      if (!tmdbMovie.movieId || !tmdbMovie.title || !tmdbMovie.posterPath || tmdbMovie.posterPath.trim() === '') {
        console.warn(`[TMDb] Movie missing required data - rejecting:`, {
          movieId: tmdbMovie.movieId || 'MISSING',
          title: tmdbMovie.title || 'MISSING',
          posterPath: tmdbMovie.posterPath || 'MISSING',
        });
        failedTitles.add(rec.title);
        return false;
      }

      console.log(`[TMDb] Movie found and validated:`, {
        id: tmdbMovie.movieId,
        title: tmdbMovie.title,
        genres: tmdbMovie.genres,
        year: tmdbMovie.releaseYear,
        hasPoster: !!tmdbMovie.posterPath,
      });

      // OPTIMIZATION: Fetch trailer from both sources in parallel (non-blocking, timeout after 2 seconds)
      // This significantly speeds up processing - trailers are optional, movies are not
      // CRITICAL: Prioritize TMDb videos API (uses movieId) over YouTube search (uses title) to avoid mismatched trailers
      let trailerKey: string | null = null;
      const trailerPromise = (async () => {
        try {
          // Extract interface language (ru-RU -> ru, en-US -> en, etc.)
          const interfaceLanguage = language.split('-')[0].toLowerCase();
          
          // PRIORITY 1: Fetch from TMDb videos API first (uses movieId, ensures correct movie)
          // This is more reliable than YouTube search which can match similar-named movies
          const tmdbResult = await this.tmdbService.getMovieVideos(tmdbMovie.movieId, language);
          
          if (tmdbResult) {
            trailerKey = tmdbResult;
            console.log(`[TMDb] Trailer found from TMDb videos API (movieId-based) for ${tmdbMovie.title}`);
          } else {
            // FALLBACK: Only use YouTube search if TMDb doesn't have a trailer
            // Get both Russian and English titles for YouTube search
            const movieTitles = await this.tmdbService.getMovieTitles(tmdbMovie.movieId);
            const titleRu = movieTitles?.titleRu || tmdbMovie.title;
            const titleEn = movieTitles?.titleEn || tmdbMovie.title;
            
            const youtubeResult = await this.tmdbService.searchTrailerOnYouTube(titleRu, titleEn, interfaceLanguage);
            
            if (youtubeResult) {
              trailerKey = youtubeResult;
              console.log(`[YouTube] Trailer found from YouTube (fallback, title-based) for ${tmdbMovie.title}`);
            }
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
      
      // Calculate how many we'll request - request significantly more to account for failures
      // Request at least 15 movies to ensure we can find 3 valid ones after filtering
      const requestCount = Math.max(moviesNeeded * 5, 15);
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
        // Process more recommendations in parallel to increase chances of finding 3 valid movies
        const maxParallel = Math.min(openaiRecommendations.length, 20); // Process up to 20 in parallel
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

    // FINAL VALIDATION: Filter out any movies with missing critical data before returning
    const validMovies = movies.filter(movie => {
      const isValid = 
        movie.movieId && 
        movie.movieId.trim() !== '' &&
        movie.title && 
        movie.title.trim() !== '' &&
        movie.posterPath && 
        movie.posterPath.trim() !== '' &&
        movie.posterPath !== 'https://image.tmdb.org/t/p/w500'; // Not just the base URL without path

      if (!isValid) {
        console.warn(`[Recommendations] Filtering out invalid movie:`, {
          movieId: movie.movieId || 'MISSING',
          title: movie.title || 'MISSING',
          posterPath: movie.posterPath || 'MISSING',
        });
      }

      return isValid;
    });

    // Validate final result - be more lenient, allow partial results
    if (validMovies.length === 0) {
      const hasExclusions = recommendDto.excludeIds && recommendDto.excludeIds.length > 0;
      const errorMessage = hasExclusions
        ? 'Could not find additional matching movies. All recommendations may have already been shown. Please try again with different preferences.'
        : 'Could not find matching movies. Please try again with different preferences.';
      
      console.error(`[Recommendations] No valid movies found after filtering. Original count: ${movies.length}, Valid count: ${validMovies.length}`);
      throw new HttpException(
        errorMessage,
        HttpStatus.NOT_FOUND,
      );
    }

    // Log final result
    if (validMovies.length < movies.length) {
      console.warn(`[Recommendations] Filtered out ${movies.length - validMovies.length} invalid movie(s). Returning ${validMovies.length} valid movie(s).`);
    }

    // CRITICAL: Always return exactly 3 movies or throw error - no partial results
    if (validMovies.length < 3) {
      const hasExclusions = recommendDto.excludeIds && recommendDto.excludeIds.length > 0;
      const errorMessage = hasExclusions
        ? `Could not find 3 matching movies. Found ${validMovies.length} valid movie(s) after ${attemptCount} attempts. All recommendations may have already been shown. Please try again with different preferences.`
        : `Could not find 3 matching movies. Found ${validMovies.length} valid movie(s) after ${attemptCount} attempts. Please try again with different preferences.`;
      
      console.error(`[Recommendations] FAILED: Only found ${validMovies.length} valid movie(s) after ${attemptCount} attempts (required 3).`);
      throw new HttpException(
        errorMessage,
        HttpStatus.NOT_FOUND,
      );
    }

    console.log(`[Recommendations] Successfully returning 3 valid movie(s) after ${attemptCount} attempt(s)`);

    // Log all returned movies for debugging
    validMovies.slice(0, 3).forEach((movie, index) => {
      console.log(`[Recommendations] Movie ${index + 1}: "${movie.title}" (ID: ${movie.movieId}, Poster: ${movie.posterPath ? 'YES' : 'NO'})`);
    });

    // Return exactly 3 movies
    return validMovies.slice(0, 3);
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

      // VALIDATION: Check if poster exists - required for valid movie
      if (!response.data.poster_path || response.data.poster_path.trim() === '') {
        console.warn(`[TMDb] Movie "${response.data.title}" (ID: ${response.data.id}) has no poster - rejecting`);
        throw new HttpException(
          'Movie poster not available',
          HttpStatus.NOT_FOUND,
        );
      }

      const movieInfo = {
        movieId: response.data.id.toString(),
        title: response.data.title,
        posterPath: `https://image.tmdb.org/t/p/w500${response.data.poster_path}`,
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
          const omdbResponse = await axios.get(`http://www.omdbapi.com/`, {
            params: {
              i: imdbId,
              apikey: process.env.OMDB_API_KEY || '',
            },
            timeout: 3000,
          });
          if (omdbResponse.data?.imdbRating) {
            const rawRating = parseFloat(omdbResponse.data.imdbRating);
            imdbRating = validateImdbRating(rawRating);
          }
        } catch (omdbError) {
          // TMDb vote_average is already on 0-10 scale, use it directly
          if (response.data.vote_average !== undefined && response.data.vote_average !== null) {
            imdbRating = validateImdbRating(response.data.vote_average);
          }
        }
      } else if (response.data.vote_average !== undefined && response.data.vote_average !== null) {
        // TMDb vote_average is already on 0-10 scale, use it directly
        imdbRating = validateImdbRating(response.data.vote_average);
      }

      // PRIMARY: Fetch trailer from TMDb videos API first (uses movieId, ensures correct movie)
      // This is more reliable than YouTube search which can match similar-named movies
      let trailerKey: string | null = null;
      try {
        trailerKey = await this.tmdbService.getMovieVideos(movieId, language);
        if (trailerKey) {
          console.log(`[TMDb] Trailer found from TMDb videos API (movieId-based) for ${movieId} in language ${language}`);
        }
      } catch (videoError) {
        console.log(`[TMDb] Could not fetch trailer from TMDb videos for ${movieId}:`, videoError.message);
      }
      
      // FALLBACK: Only use YouTube search if TMDb doesn't have a trailer
      // This ensures we prioritize movieId-based matching over title-based matching
      if (!trailerKey) {
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
            console.log(`[YouTube] Trailer found from YouTube (fallback, title-based) for ${movieId} in language ${interfaceLanguage}`);
          }
        } catch (youtubeError) {
          console.log(`[YouTube] Could not find trailer on YouTube for ${movieId}:`, youtubeError.message);
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

