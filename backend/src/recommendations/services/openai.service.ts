import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OpenAIRecommendation } from '../interfaces/movie.interface';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async getRecommendations(
    prompt: string,
  ): Promise<OpenAIRecommendation[]> {
    const startTime = Date.now();

    try {
      // Define the Schema for strict validation
      const responseSchema = {
        type: 'json_schema' as const,
        json_schema: {
          name: 'movie_recommendations',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              recommendations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: {
                      type: 'string',
                      description: 'The exact English title as found on TMDb.',
                    },
                    year: {
                      type: 'number',
                      description: 'The release year.',
                    },
                    reason: {
                      type: 'string',
                      description: 'A recommendation reason in Russian.',
                    },
                  },
                  required: ['title', 'year', 'reason'],
                  additionalProperties: false,
                },
              },
            },
            required: ['recommendations'],
            additionalProperties: false,
          },
        },
      };

      // Try strict schema first with gpt-4o-2024-08-06
      let response: any;

      try {
        const requestConfig = {
          model: 'gpt-4o-2024-08-06' as const, // CRITICAL: Use a model that supports strict outputs
          messages: [
            {
              role: 'system' as const,
              content:
                'You are a movie recommendation expert. Always return valid JSON that strictly matches the provided schema, with no additional text or markdown formatting.',
            },
            {
              role: 'user' as const,
              content: prompt,
            },
          ],
          response_format: responseSchema, // Use the strict schema here
          temperature: 0.3, // Lower temperature for more focused, less random recommendations
        };

        response = await this.openai.chat.completions.create(requestConfig);
      } catch (modelError: any) {
        // If strict schema model fails (e.g., model not available), fallback to json_object mode
        this.logger.warn('[OpenAI] Strict schema model failed, falling back to json_object mode', modelError.message, 'OpenAIService');
        
        const fallbackConfig = {
          model: 'gpt-4o-mini' as const, // Fallback model
          messages: [
            {
              role: 'system' as const,
              content:
                'You are a movie recommendation expert. Always return valid JSON in this exact format: {"recommendations": [{"title": "...", "year": 2020, "reason": "..."}]}, with no additional text or markdown formatting.',
            },
            {
              role: 'user' as const,
              content: prompt,
            },
          ],
          response_format: { type: 'json_object' as const },
          temperature: 0.3,
        };

        response = await this.openai.chat.completions.create(fallbackConfig);
      }
      const duration = Date.now() - startTime;

      const content = response.choices[0]?.message?.content;

      if (!content) {
        this.logger.error('[OpenAI] No content in response', '', 'OpenAIService', {
          fullResponse: JSON.stringify(response, null, 2),
          duration: `${duration}ms`,
        });
        throw new Error('No content in OpenAI response');
      }

      // Parse the JSON response - with strict schema, this should always work
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        this.logger.error('[OpenAI] JSON parse error', parseError.stack, 'OpenAIService', {
          parseError: parseError.message,
          contentThatFailed: content,
          duration: `${duration}ms`,
        });
        throw new Error(`Failed to parse OpenAI response as JSON: ${parseError.message}`);
      }

      // With strict schema, we can trust the structure
      let recommendations: OpenAIRecommendation[];
      if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
        recommendations = parsed.recommendations;
      } else {
        this.logger.error('[OpenAI] Unexpected response format', '', 'OpenAIService', {
          parsedObject: JSON.stringify(parsed, null, 2),
          parsedKeys: Object.keys(parsed || {}),
          duration: `${duration}ms`,
        });
        throw new Error(`Unexpected response format from OpenAI. Expected object with 'recommendations' array, got: ${JSON.stringify(Object.keys(parsed || {}))}`);
      }

      // Return all recommendations (don't limit to 3) - the caller will decide how many to process
      // This allows requesting more movies than needed for retry scenarios
      return recommendations;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('[OpenAI] API error', error.stack, 'OpenAIService', {
        error: error.message,
        errorCode: (error as any).code,
        errorType: (error as any).type,
        errorStatus: (error as any).status,
        duration: `${duration}ms`,
        fullError: error, // Include full error object for debugging
      });
      
      // If it's already an HttpException, rethrow it
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Provide more detailed error message
      const errorMessage = error.message || 'Unknown error';
      throw new HttpException(
        `Failed to get recommendations from OpenAI: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

