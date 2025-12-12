import {
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { MovieHistory } from '../entities/movie-history.entity';
import { RecommendDto } from './dto';
import { OpenAIService } from './services/openai.service';
import { TMDbService } from './services/tmdb.service';
import { Movie } from './interfaces/movie.interface';
import { LoggerService } from '../common/logger/logger.service';
import { CircuitBreakerService } from '../common/circuit-breaker/circuit-breaker.service';
// Cache removed - using direct OpenAI calls with parallel processing
import { RECOMMENDATION_CONFIG } from './constants/recommendation.config';
import { getFallbackRecommendations, mapGenresToTMDbIds } from './services/tmdb-search-improvements';

@Injectable()
export class RecommendationsService {
  constructor(
    @InjectRepository(MovieHistory)
    private movieHistoryRepository: Repository<MovieHistory>,
    private openAIService: OpenAIService,
    private tmdbService: TMDbService,
    private configService: ConfigService,
    private logger: LoggerService,
    private circuitBreaker: CircuitBreakerService,

  ) { }

  // Cache hash function removed - caching system deleted



  /**
   * Process a single movie candidate.
   * This is called SEQUENTIALLY to prevent race conditions.
   * @param requiredFormat - If 'Мультфильм', validates that movie has Animation genre
   */
  private async _processCandidate(
    candidate: { title: string; year?: number; reason?: string },
    userId: string,
    language: string,
    excludeIdsSet: Set<string>,
    isFallback: boolean = false,
    requiredFormat?: string,
  ): Promise<Movie | null> {

    try {
      let searchResult = null;

      // Step 1: Search TMDb to get the ID (Try with year first, then without)
      if (candidate.year) {
        try {
          searchResult = await this.tmdbService.searchMovie(candidate.title, candidate.year, language);
        } catch (error) {
          this.logger.warn(`[SEARCH] "${candidate.title}" (${candidate.year}) - TMDb search with year failed`, 'Recommendations');
        }
      }

      if (!searchResult) {
        try {
          searchResult = await this.tmdbService.searchMovie(candidate.title, undefined, language);
        } catch (error) {
          this.logger.warn(`[SEARCH] "${candidate.title}" - TMDb search without year also failed`, 'Recommendations');
        }
      }

      if (!searchResult || !searchResult.movieId) {
        this.logger.warn(`[SEARCH FAILED] "${candidate.title}" (${candidate.year || 'no year'}) - NOT FOUND in TMDb`, 'Recommendations');
        return null;
      }


      // Step 2: Validation Checks
      // Check exclusion list (in-memory)
      if (excludeIdsSet.has(searchResult.movieId)) {
        this.logger.log(`[EXCLUDED] "${candidate.title}" - already in exclusion list`, 'Recommendations');
        return null;
      }

      // Check database state (Persistent)
      const dbCheck = await this.movieHistoryRepository.findOne({
        where: { userId, movieId: searchResult.movieId },
        select: ['userRating', 'isWatched', 'isNotInterested'],
      });

      // Only exclude if rated or not-interested (NOT for isWatched - those can be shown again)
      if (dbCheck && (dbCheck.userRating !== null || dbCheck.isNotInterested)) {
        this.logger.log(`[EXCLUDED] "${candidate.title}" - user rated or marked not-interested`, 'Recommendations');
        excludeIdsSet.add(searchResult.movieId);
        return null;
      }



      // Step 3: Get FULL details (This is where the magic happens)
      // This call handles caching, OMDb rating, and metadata gathering atomically.
      const movieDetails = await this.tmdbService.getMovieDetails(searchResult.movieId, language);
      if (!movieDetails) {
        return null;
      }

      // Step 3.5: FORMAT VALIDATION - Critical fix for format filtering
      const genres = movieDetails.genres || [];
      const genresLower = genres.map(g => g.toLowerCase());
      const isAnimated = genresLower.some(g =>
        g.includes('мультфильм') ||
        g.includes('animation') ||
        g.includes('анимация') ||
        g.includes('мультик')
      );

      // If user requested "Мультфильм", verify this is actually an animated movie
      if (requiredFormat === 'Мультфильм') {
        if (!isAnimated) {
          this.logger.warn(`[FORMAT FILTER] Rejected "${candidate.title}" - not animated. Genres: [${genres.join(', ')}]`, 'Recommendations');
          return null;
        }
        this.logger.log(`[FORMAT FILTER] Approved "${candidate.title}" - is animated. Genres: [${genres.join(', ')}]`, 'Recommendations');
      }

      // REVERSE FILTER: If user requested "Фильм" (live-action), REJECT animated movies
      if (requiredFormat === 'Фильм') {
        if (isAnimated) {
          this.logger.warn(`[FORMAT FILTER] Rejected "${candidate.title}" - is animated but user wants live-action. Genres: [${genres.join(', ')}]`, 'Recommendations');
          return null;
        }
      }



      // Step 4: Fetch Trailer (Best effort, non-blocking failure)
      let trailerKey: string | null = null;
      try {
        const movieTitles = await this.tmdbService.getMovieTitles(searchResult.movieId);
        const titleRu = movieTitles?.titleRu || searchResult.title;
        const titleEn = movieTitles?.titleEn || searchResult.title;
        const interfaceLanguage = language.split('-')[0].toLowerCase();

        trailerKey = await this.tmdbService.searchTrailerOnYouTube(titleRu, titleEn, interfaceLanguage);
        if (!trailerKey) {
          trailerKey = await this.tmdbService.getMovieVideos(searchResult.movieId, language);
        }
      } catch (error) {
        // Ignore trailer errors, they are not critical
      }

      // Step 5: Save to Database & Assemble Object
      let savedHistory;
      try {
        const existingHistory = await this.movieHistoryRepository.findOne({
          where: { userId, movieId: searchResult.movieId },
        });

        // Determine the best available poster
        const finalPoster = movieDetails.posterPath || searchResult.posterPath || '';
        const englishTitleForDb = (await this.tmdbService.getMovieTitles(searchResult.movieId))?.titleEn || searchResult.title;

        if (!existingHistory) {
          savedHistory = await this.movieHistoryRepository.save({
            userId,
            movieId: searchResult.movieId,
            title: searchResult.title,
            posterPath: finalPoster,
            englishTitle: englishTitleForDb,
            trailerKey: trailerKey || null,
            shownAt: new Date(),
          });
        } else {
          savedHistory = existingHistory;
        }
      } catch (saveError) {
        this.logger.error(`Failed to save movie to history`, saveError.stack, 'Recommendations');
        return null;
      }

      // Assemble final object from the verified movieDetails data
      const finalMovie: Movie = {
        movieId: searchResult.movieId,
        title: searchResult.title,
        posterPath: movieDetails.posterPath || searchResult.posterPath || '',
        historyId: savedHistory.id,
        reason: isFallback
          ? 'Рекомендация на основе ваших предпочтений'
          : candidate.reason || 'Рекомендация на основе ваших предпочтений',

        // Metadata
        genres: movieDetails.genres || [],
        releaseYear: movieDetails.releaseYear || searchResult.releaseYear || '',
        overview: movieDetails.overview,
        country: movieDetails.country,
        runtime: movieDetails.runtime,
        imdbRating: movieDetails.imdbRating,
        ageRating: movieDetails.ageRating,
        trailerKey: trailerKey || undefined,

        // Status
        isWatched: savedHistory.isWatched || false,
        isNotInterested: savedHistory.isNotInterested || false,
        userRating: savedHistory.userRating,
        averageRating: undefined,
        ratingCount: undefined,
      };

      return finalMovie;
    } catch (error) {
      this.logger.error(`[_processCandidate] Unexpected error for: ${candidate.title}`, error.stack, 'Recommendations');
      return null;
    }
  }

  /**
   * Build AI prompt with full logic
   */
  private _buildAiPrompt(
    dto: RecommendDto,
    moviesNeeded: number,
    failedTitles: Set<string>,
    foundTitles: string[],
    moviesToAvoidWithEnglishTitles: Array<{ title: string }>,
    excludedTitles: string[],
  ): string {
    // Helper function to check if similarTo conflicts with moods/tags
    const checkSimilarToConflict = (similarTo: string, moods: string[], tags: string[]): boolean => {
      const similarToLower = similarTo.toLowerCase();
      const hasFantasyMagic = similarToLower.includes('гарри поттер') ||
        similarToLower.includes('harry potter') ||
        similarToLower.includes('фэнтези') ||
        similarToLower.includes('магия') ||
        similarToLower.includes('волшеб');
      const hasCrimeAction = moods.includes('Адреналин') ||
        tags.some(tag => tag.includes('Криминал') || tag.includes('криминальный'));
      if (hasFantasyMagic && hasCrimeAction) {
        return true;
      }
      return false;
    };

    const allAvoidedTitles = [
      ...moviesToAvoidWithEnglishTitles.map((h) => h.title),
      ...excludedTitles,
      ...foundTitles,
      ...Array.from(failedTitles),
    ];

    const historyString =
      allAvoidedTitles.length > 0
        ? allAvoidedTitles.join(', ')
        : 'No viewing history';

    const isGeneratingMore = dto.excludeIds && dto.excludeIds.length > 0;
    const requestCount = 10; // Request 10 candidates to serve as a pool
    const movieCountInstruction = moviesNeeded === 3
      ? (isGeneratingMore ? 'recommend 3 NEW movies (different from previously shown ones)' : 'recommend exactly 3 movies')
      : `recommend ${requestCount} movies (you previously suggested movies that could not be found, so provide ${requestCount} NEW different movies as backups)`;

    let prompt = `You are a professional movie recommendation expert. Your task is to ${movieCountInstruction} that match the user's specific preferences as closely as possible. 

🚫 CRITICAL RULE #1: DO NOT recommend random or popular movies. Every recommendation should match the user's preferences. Prioritize movies that match ALL criteria, but if perfect matches are limited, recommend the best available matches that align with the core preferences.

🚫 CRITICAL RULE #2: Use EXACT English titles as they appear in TMDb (The Movie Database). If a movie has a Russian title, you MUST still use its English title from TMDb. For example, use "Zombieland: Double Tap" NOT "Зомбилэнд: Контрольный выстрел". Search TMDb mentally to ensure the title exists exactly as written.

✅ REQUIREMENT: Find movies that match the user's preferences below. Prioritize movies that match ALL criteria, but ensure you always return ${requestCount} recommendations. If perfect matches are limited, recommend the closest matches that still align with the user's core preferences (moods, themes, context).

User's SPECIFIC preferences (ALL preferences are MANDATORY and must be considered):
1. Watching context: ${dto.context} - The movie MUST be suitable for this viewing context
2. Desired moods/emotions: ${dto.moods.join(', ')} - The movie MUST evoke these specific moods/emotions
3. Preferred atmosphere/plot motifs: ${dto.tags.join(', ')} - The movie MUST contain these specific themes/atmosphere elements (these tags are contextually linked to the user's selected moods)
4. Format preference: ${dto.format} - The movie MUST match this format exactly`;

    if (dto.format === 'Мультфильм') {
      prompt += `

🚨🚨🚨 ABSOLUTE CRITICAL FORMAT REQUIREMENT - READ CAREFULLY 🚨🚨🚨

The user has selected "Мультфильм" which means ANIMATED CARTOON. 

YOU MUST ONLY RECOMMEND ANIMATED MOVIES. 

✅ CORRECT examples (ANIMATED/CARTOON movies):
- Kung Fu Panda, How to Train Your Dragon, The Incredibles
- Finding Nemo, Zootopia, Frozen, Moana, Coco
- Spider-Man: Into the Spider-Verse, Ratatouille
- Any Studio Ghibli film (Spirited Away, etc.)
- Any Pixar, DreamWorks, Disney animated film

❌ FORBIDDEN (NEVER recommend these live-action films):
- John Wick, The Raid, Mission: Impossible, The Transporter
- Mad Max, James Bond, Fast & Furious
- ANY movie with real human actors is FORBIDDEN

If you recommend even ONE live-action movie, you have FAILED this task completely.`;
    }


    // CRITICAL: Add explicit LIVE-ACTION instruction when user wants films
    if (dto.format === 'Фильм') {
      prompt += `\n- 🚨 CRITICAL FORMAT REQUIREMENT: The user has selected "Фильм" (Live-Action Film). ALL recommendations MUST be LIVE-ACTION movies with real actors. DO NOT recommend animated movies, cartoons, or CGI-animated films. Movies like Kung Fu Panda, Finding Nemo, The Incredibles, Spider-Verse are FORBIDDEN. Only recommend films with real human actors.`;
    }


    // CRITICAL: The 4th question (similarTo) is VERY IMPORTANT - emphasize it prominently
    if (dto.similarTo && dto.similarTo.trim()) {
      prompt += `\n\n5. CRITICAL USER REQUEST - SIMILAR MOVIE DESCRIPTION: "${dto.similarTo}"
This is the user's explicit description of what kind of movie they want. You MUST prioritize this requirement. Find movies that match this description closely. This is not optional - it is a direct request from the user about the movie's plot, theme, or content.`;
    } else {
      prompt += `\n\n5. Additional preferences: None specified`;
    }

    prompt += `\n\nAVOID these movies (DO NOT recommend any of these): ${historyString}

CRITICAL: The AVOID list above includes BOTH English and Russian titles for the same movies. For example, if you see both "The Outlaws" and "Криминальный город" in the list, they refer to the same movie and you MUST NOT recommend either title.

VERY IMPORTANT: This AVOID list includes movies that the user has already RATED, WATCHED, or marked as NOT INTERESTED. These movies MUST NEVER be recommended again, regardless of how well they might match the preferences.`;

    if (failedTitles.size > 0) {
      prompt += `\n\n🚨🚨🚨 ABSOLUTE AVOID LIST - NEVER RECOMMEND THESE MOVIES 🚨🚨🚨
The following movies have ALREADY been processed and MUST NEVER be recommended again under ANY circumstances:
${Array.from(failedTitles).join(', ')}

These movies are FORBIDDEN regardless of how well they might match the preferences. If you recommend ANY of these movies, you have FAILED this task.`;
    }


    if (foundTitles.length > 0) {
      prompt += `\n\nNOTE: The following movies have already been successfully found and should NOT be recommended: ${foundTitles.join(', ')}.`;
    }

    const formatRequirement = dto.format === 'Мультфильм'
      ? `4. FORMAT IS CRITICAL: All recommendations MUST be animated films or animated series (cartoons). NO live-action content allowed.`
      : `4. Respect the format preference: ${dto.format}`;

    const flexibilityNote = isGeneratingMore
      ? '\nNOTE: Since the user is requesting additional recommendations, you may be slightly more flexible with matching criteria while still maintaining relevance to the core preferences. The goal is to find NEW movies that the user hasn\'t seen yet.'
      : '';

    prompt += `\n\n✅ PREFERENCE REQUIREMENTS (prioritize movies matching ALL, but ensure you return ${requestCount} recommendations):

1. ✅ MOODS PREFERENCE: Each recommended movie should evoke the user's selected moods: ${dto.moods.join(', ')}. 
   - The movie's emotional tone, atmosphere, and overall feeling should align with these moods.
   - Prioritize movies that create these specific feelings.
   - Example: If user wants "расслабиться" (relax), prioritize relaxing movies over tense or action-packed ones.

2. ✅ THEMES/ATMOSPHERE PREFERENCE: Each recommended movie should contain the themes/atmosphere elements: ${dto.tags.join(', ')}. 
   - These tags represent plot motifs, visual style, narrative elements, or thematic content.
   - Prioritize movies that feature these elements prominently.
   - Example: If user wants "🏡 Уют" (cozy), prioritize movies with cozy, warm atmosphere.

3. ✅ WATCHING CONTEXT PREFERENCE: Each recommended movie should be suitable for the viewing context: ${dto.context}. 
   - Consider the user's situation and ensure the movie fits this context.
   - Example: If context is "один" (alone), prioritize movies suitable for solo viewing.

4. ✅ FORMAT PREFERENCE: ${formatRequirement}`;

    // Emphasize similarTo requirement - check if it conflicts with Q2/Q3
    if (dto.similarTo && dto.similarTo.trim()) {
      const hasConflict = checkSimilarToConflict(dto.similarTo, dto.moods, dto.tags);

      if (hasConflict) {
        prompt += `\n\n🚨🚨🚨 CRITICAL - USER EXPLICIT REQUEST (ABSOLUTE HIGHEST PRIORITY) 🚨🚨🚨: 

The user explicitly described what they want: "${dto.similarTo}"

⚠️⚠️⚠️ THIS IS THE MOST IMPORTANT REQUIREMENT - IT OVERRIDES EVERYTHING ELSE ⚠️⚠️⚠️

🚨 CRITICAL INSTRUCTION: This request does NOT align with the previously selected moods (${dto.moods.join(', ')}) and tags (${dto.tags.join(', ')}). 
In this case, you MUST IGNORE the previous selections and prioritize ONLY this explicit request.

✅ MANDATORY REQUIREMENT: Each and EVERY recommended movie MUST match this description closely:
- Plot structure and story elements (MUST match)
- Theme and subject matter (MUST match)
- Setting and time period (MUST match)
- Character types and relationships (MUST match)
- Genre conventions and style (MUST match)
- Overall narrative approach (MUST match)
- Country/region if specified (e.g., "Южной Кореи" means Korean movies - MANDATORY)
- Specific genre/style if mentioned (e.g., "криминальная комедия" means crime comedy - MANDATORY)

🚫🚫🚫 ABSOLUTE RULE: DO NOT consider the previous mood/tag selections. Focus ONLY on matching: "${dto.similarTo}".

✅ VALIDATION: Before recommending each movie, ask: "Does this movie match '${dto.similarTo}'?" If NO or UNCERTAIN, DO NOT recommend it.

Example: If user wants "как Криминальный город, криминальная комедия Южной Кореи", you MUST recommend ONLY Korean crime comedies similar to "The Outlaws". Do NOT recommend any other type of movie, regardless of mood/tag selections.`;
      } else {
        prompt += `\n\n5. 🚨🚨🚨 CRITICAL - SIMILAR MOVIE REQUIREMENT (HIGHEST PRIORITY) 🚨🚨🚨: 

The user explicitly described what they want: "${dto.similarTo}"

⚠️⚠️⚠️ THIS IS THE MOST IMPORTANT REQUIREMENT - IT TAKES PRECEDENCE OVER ALL OTHERS ⚠️⚠️⚠️

✅ MANDATORY REQUIREMENT: Each and EVERY recommended movie MUST match this description closely in terms of:
- Plot structure and story elements (MUST match)
- Theme and subject matter (MUST match)
- Setting and time period (MUST match)
- Character types and relationships (MUST match)
- Genre conventions and style (MUST match)
- Overall narrative approach (MUST match)
- Country/region if specified (e.g., "Южной Кореи" means Korean movies - MANDATORY)
- Specific genre/style if mentioned (e.g., "криминальная комедия" means crime comedy - MANDATORY)

🚫🚫🚫 ABSOLUTE RULE: If a movie doesn't match this description, DO NOT recommend it, even if it matches other criteria. This requirement takes precedence over all others.

✅ VALIDATION: Before recommending each movie, ask yourself: "Does this movie match the user's description: '${dto.similarTo}'?" If the answer is NO or UNCERTAIN, DO NOT recommend it.

Example: If user wants "как Криминальный город, криминальная комедия Южной Кореи", you MUST recommend ONLY Korean crime comedies similar to "The Outlaws".`;
      }
    } else {
      prompt += `\n\n5. Similar movie preference: Not specified (user skipped this question)`;
    }

    prompt += `

🚫 STRICT FILTERING RULES (ALL MUST BE FOLLOWED - NO EXCEPTIONS):
6. 🚨 ABSOLUTE REQUIREMENT: DO NOT recommend random or popular movies. Every single recommendation MUST match the user's preferences. Random recommendations are STRICTLY FORBIDDEN.
7. 🚨 ABSOLUTE REQUIREMENT: DO NOT recommend movies from the AVOID list above (this includes movies the user has RATED, WATCHED, or marked as NOT INTERESTED)
8. 🚨 ABSOLUTE REQUIREMENT: Each movie MUST have a clear, direct connection to ALL user preferences listed above - partial matches are NOT acceptable
9. 🚨 ABSOLUTE REQUIREMENT: If you cannot find movies that match ALL criteria, DO NOT recommend movies that only partially match - it's better to be more specific
10. 🚨 CRITICAL: If the user provided a specific description (similarTo), EVERY recommendation MUST match that description. If a movie doesn't match the description, DO NOT recommend it, even if it matches other criteria.
11. Ensure diversity while maintaining strict relevance to ALL preferences
12. Prioritize movies available on major streaming platforms
13. Use exact movie titles as they appear in TMDb database${flexibilityNote}

⚠️ VALIDATION BEFORE RECOMMENDING: Before adding each movie to your recommendations, ask yourself:
- Does this movie match the user's explicit description? (If similarTo was provided, this is MANDATORY)
- Does this movie match the selected moods? (MANDATORY)
- Does this movie match the selected themes/tags? (MANDATORY)
- Does this movie fit the viewing context? (MANDATORY)
- Does this movie match the format? (MANDATORY)
- Is this movie NOT in the AVOID list? (MANDATORY)

If ANY answer is NO, DO NOT recommend that movie. Only recommend movies where ALL answers are YES.

✅ RECOMMENDATION PRIORITY (STRICT ENFORCEMENT):
- 🚨 MANDATORY: Prioritize movies where ALL answers are YES (moods, themes, context, format, AND similarTo if provided)
- 🚨 MANDATORY: If similarTo was provided, EVERY recommendation MUST match that description. This is non-negotiable.
- 🚨 MANDATORY: If perfect matches are limited, DO NOT recommend random movies. Only recommend movies that match the core preferences (moods, themes, AND similarTo if provided)
- 🚨 MANDATORY: Always return ${requestCount} recommendations - never return an empty array
- 🚨 MANDATORY: Quality and relevance are CRITICAL - only recommend movies that truly align with user preferences
- 🚨 FORBIDDEN: Do NOT recommend movies just because they are popular or well-known. They MUST match the user's preferences.

Return ONLY a JSON object with a "recommendations" array containing exactly ${requestCount} objects, each with "title", "year", and "reason" keys. 

⚠️ CRITICAL: You MUST return exactly ${requestCount} recommendations. Never return an empty array. If perfect matches are limited, return the best available matches that align with the user's core preferences.

The "reason" MUST be a specific sentence (in Russian) explaining HOW this movie matches the user's preferences:
- How it matches the moods: ${dto.moods.join(', ')}
- How it matches the themes: ${dto.tags.join(', ')}
- How it fits the context: ${dto.context}
${dto.similarTo ? `- How it matches the description: "${dto.similarTo}"` : ''}

Even if a movie doesn't match ALL preferences perfectly, explain how it aligns with the core preferences (moods and themes). 

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
  }

  /**
   * Wrapper for OpenAI Call
   */
  private async _getOpenAICandidates(prompt: string): Promise<any[]> {
    return this.openAIService.getRecommendations(prompt);
  }

  async getRecommendations(
    userId: string,
    recommendDto: RecommendDto,
  ): Promise<Movie[]> {
    const language = recommendDto.language || 'ru-RU';
    const movies: Movie[] = [];
    const addedMovieIds = new Set<string>();

    // Cache system removed - using direct OpenAI calls

    // 2. Initialize Exclusions
    const excludeIdsSet = new Set<string>(recommendDto.excludeIds || []);

    // 3. Load History & Exclude (Optimized Selection)
    const movieHistory = await this.movieHistoryRepository.find({
      where: { userId },
      order: { shownAt: 'DESC' },
      take: 100,
      select: ['movieId', 'isWatched', 'isNotInterested', 'userRating'],
    });

    // Only exclude movies that user has RATED or marked NOT INTERESTED
    // Previously-shown movies (isWatched) CAN be recommended again!
    movieHistory.forEach(h => {
      if (h.isNotInterested || h.userRating !== null) {
        excludeIdsSet.add(h.movieId);
      }
    });

    // Build movies to avoid with English titles for prompt (only rated + not-interested)
    const moviesToAvoidWithEnglishTitles: Array<{ title: string }> = [];
    const titlePromises = movieHistory
      .filter(h => h.isNotInterested || h.userRating !== null)
      .map(async (movie) => {

        const titles: string[] = [];
        try {
          const movieTitles = await this.tmdbService.getMovieTitles(movie.movieId);
          if (movieTitles?.titleEn) titles.push(movieTitles.titleEn);
          if (movieTitles?.titleRu) titles.push(movieTitles.titleRu);
        } catch (error) {
          // Ignore errors
        }
        return titles.map(title => ({ title }));
      });
    const titleResults = await Promise.all(titlePromises);
    moviesToAvoidWithEnglishTitles.push(...titleResults.flat());

    // Fetch titles for excluded IDs if provided
    const excludedTitles: string[] = [];
    if (recommendDto.excludeIds && recommendDto.excludeIds.length > 0) {
      const excludedTitlePromises = recommendDto.excludeIds.map(async (movieId) => {
        try {
          const movieTitles = await this.tmdbService.getMovieTitles(movieId);
          if (movieTitles) {
            if (movieTitles.titleRu) excludedTitles.push(movieTitles.titleRu);
            if (movieTitles.titleEn) excludedTitles.push(movieTitles.titleEn);
          }
        } catch (error) {
          // Ignore errors
        }
        return [];
      });
      await Promise.all(excludedTitlePromises);
    }

    const failedTitles = new Set<string>();
    const REQUIRED_COUNT = 3;
    let aiAttempts = 0;
    const MAX_AI_ATTEMPTS = 3;

    // Cache removed - always fetch fresh candidates from OpenAI
    let candidates: any[] | undefined = undefined;


    // ==========================================
    // AI LOOP
    // ==========================================
    while (movies.length < REQUIRED_COUNT && aiAttempts < MAX_AI_ATTEMPTS) {
      aiAttempts++;

      // If we have no candidates (cache miss or exhausted cache), ask OpenAI
      if (!candidates || candidates.length === 0) {
        if (this.circuitBreaker.isOpen('OpenAI')) {
          this.logger.warn('Circuit Breaker OPEN. Skipping OpenAI.', 'Recommendations');
          break; // Go to fallback
        }

        try {
          this.logger.log(`Calling OpenAI (Attempt ${aiAttempts})...`, 'Recommendations');

          // Build prompt using the helper method
          const prompt = this._buildAiPrompt(
            recommendDto,
            REQUIRED_COUNT - movies.length,
            failedTitles,
            movies.map((m) => m.title),
            moviesToAvoidWithEnglishTitles,
            excludedTitles,
          );

          candidates = await this.circuitBreaker.execute(
            'OpenAI',
            () => this._getOpenAICandidates(prompt),
            { timeout: 30000 }
          );

          // Cache removed - no caching of candidates
        } catch (err) {
          this.logger.error('OpenAI Call Failed', err.stack, 'Recommendations');
          break; // Go to fallback on API error
        }
      }

      // --- PARALLEL PROCESSING (Safe now with local variable isolation) ---
      // Process all candidates in parallel for speed, then take the first 3 valid ones
      if (candidates && candidates.length > 0) {
        this.logger.log(`Processing ${candidates.length} candidates in PARALLEL...`, 'Recommendations');

        const candidatesToProcess = candidates;
        candidates = []; // Clear current list so next loop iteration gets fresh ones if needed

        // Process all candidates in parallel
        const results = await Promise.all(
          candidatesToProcess.map(candidate =>
            this._processCandidate(
              { title: candidate.title, year: candidate.year, reason: candidate.reason },
              userId,
              language,
              excludeIdsSet,
              false,
              recommendDto.format
            ).catch(() => null) // Catch individual errors, return null
          )
        );

        // Filter valid results and add to movies
        for (const movie of results) {
          if (movies.length >= REQUIRED_COUNT) break;

          if (movie && !addedMovieIds.has(movie.movieId) && !movies.some(m => m.movieId === movie.movieId)) {
            movies.push(movie);
            addedMovieIds.add(movie.movieId);
            excludeIdsSet.add(movie.movieId);
            this.logger.log(`[OK] Added: ${movie.title}`, 'Recommendations');
          }
        }

        // Track failed titles for next prompt
        candidatesToProcess.forEach((candidate, index) => {
          if (!results[index]) {
            failedTitles.add(candidate.title);
          }
        });
      }


      // Break outer loop if done
      if (movies.length >= REQUIRED_COUNT) break;
    }

    // ==========================================
    // FALLBACK PHASE
    // ==========================================
    if (movies.length < 3) {
      this.logger.warn(`Only found ${movies.length} movies. Entering Fallback Mode.`, 'Recommendations');
      const needed = 3 - movies.length;

      try {
        // Mapping Logic
        let genreIds = mapGenresToTMDbIds([...recommendDto.moods, ...recommendDto.tags]);

        // --- CRITICAL FIX for CARTOONS ---
        if (recommendDto.format === 'Мультфильм') {
          this.logger.log('Fallback Mode: User selected CARTOON. Forcing Genre ID 16.', 'Recommendations');
          genreIds = [16]; // Override EVERYTHING else. Only Animations.
        }

        const allExcludes = [...Array.from(excludeIdsSet)];
        const apiKey = this.configService.get<string>('TMDB_API_KEY');
        const baseUrl = this.configService.get<string>('TMDB_BASE_URL');

        const fallbackCandidates = await getFallbackRecommendations(
          genreIds,
          undefined, // Year undefined
          allExcludes,
          language,
          apiKey,
          baseUrl,
          15 // Get 15 candidates
        );

        if (fallbackCandidates && fallbackCandidates.length > 0) {
          // SEQUENTIAL PROCESSING FOR FALLBACK TOO
          this.logger.log('Processing fallback candidates sequentially...', 'Recommendations');

          for (const candidate of fallbackCandidates) {
            if (movies.length >= 3) break;

            const movie = await this._processCandidate(
              { title: candidate.title, year: parseInt(candidate.releaseYear) },
              userId,
              language,
              excludeIdsSet,
              true, // isFallback = true
              recommendDto.format // Pass format for validation
            );

            if (movie && !addedMovieIds.has(movie.movieId)) {
              movies.push(movie);
              addedMovieIds.add(movie.movieId);
              this.logger.log(`[OK-Fallback] Added: ${movie.title}`, 'Recommendations');
            }
          }
        }

      } catch (e) {
        this.logger.error('Fallback Phase Failed', e.stack, 'Recommendations');
      }
    }

    if (movies.length === 0) {
      throw new HttpException('Could not find matching movies.', HttpStatus.NOT_FOUND);
    }

    return movies.slice(0, 3);
  }

  // --- Public helper for other controllers ---
  async getMovieDetails(userId: string, movieId: string, language: string = 'ru-RU'): Promise<Movie> {
    // Re-use logic from _processCandidate style or tmdbService directly
    // Simplified here:
    const details = await this.tmdbService.getMovieDetails(movieId, language);
    if (!details) throw new HttpException('Not Found', HttpStatus.NOT_FOUND);

    // Simple wrapper to match your existing public endpoint signature
    return {
      movieId,
      title: details.title || '',
      posterPath: details.posterPath || '',
      genres: details.genres,
      overview: details.overview,
      releaseYear: details.releaseYear,
      country: details.country,
      runtime: details.runtime,
      imdbRating: details.imdbRating,
      ageRating: details.ageRating,
      historyId: '',
      isWatched: false,
      isNotInterested: false,
      // Fetch trailer, history status etc properly here if needed for Detail Page
      // ... 
    };
  }


}

