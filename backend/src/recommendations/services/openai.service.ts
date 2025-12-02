import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OpenAIRecommendation } from '../interfaces/movie.interface';

@Injectable()
export class OpenAIService {
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async getRecommendations(
    prompt: string,
  ): Promise<OpenAIRecommendation[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // or 'gpt-4-turbo' if gpt-4o is not available
        messages: [
          {
            role: 'system',
            content:
              'You are a movie recommendation expert. Always return valid JSON arrays only, with no additional text or markdown formatting.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Lower temperature for more focused, less random recommendations
      });

      const content = response.choices[0].message.content;

      // Parse the JSON response
      const parsed = JSON.parse(content);

      // Handle both direct array and object with array property
      let recommendations: OpenAIRecommendation[];
      if (Array.isArray(parsed)) {
        recommendations = parsed;
      } else if (parsed.movies && Array.isArray(parsed.movies)) {
        recommendations = parsed.movies;
      } else if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
        recommendations = parsed.recommendations;
      } else {
        throw new Error('Unexpected response format from OpenAI');
      }

      console.log('[OpenAI] Parsed recommendations:', JSON.stringify(recommendations, null, 2));

      return recommendations.slice(0, 3); // Ensure we only return 3
    } catch (error) {
      console.error('[OpenAI] API error:', error);
      throw new HttpException(
        'Failed to get recommendations from OpenAI',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

