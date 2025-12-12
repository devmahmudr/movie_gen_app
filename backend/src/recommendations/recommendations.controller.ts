import { Controller, Post, Get, Body, Request, UseGuards, Param, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RecommendationsService } from './recommendations.service';
import { RecommendDto } from './dto';
import { LoggerService } from '../common/logger/logger.service';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

@Controller('recommend')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
    private readonly logger: LoggerService,
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) { }

  @UseGuards(JwtAuthGuard)
  @Post()
  async recommend(@Request() req, @Body() recommendDto: RecommendDto) {
    const requestId = req['requestId'] || 'unknown';
    this.logger.setRequestId(requestId);

    try {
      return await this.recommendationsService.getRecommendations(
        req.user.id,
        recommendDto,
      );
    } catch (error) {
      // Log the error for debugging
      this.logger.error('Error getting recommendations', error.stack, 'RecommendationsController', {
        error: error.message,
        userId: req.user.id,
        recommendDto,
      });

      // Re-throw to let NestJS handle it (will return appropriate HTTP status)
      throw error;
    }
  }


  @Get('health')
  @HealthCheck()
  async check() {
    try {
      const healthResult = await this.health.check([
        () => this.db.pingCheck('database', { timeout: 5000 }),
      ]);
      return healthResult;
    } catch (error) {
      this.logger.error('Health check failed', error.stack, 'RecommendationsController');
      return {
        status: 'error',
        info: {},
        error: {
          database: {
            status: 'down',
            message: error.message || 'Health check failed',
          },
        },
        details: {
          database: {
            status: 'down',
            message: error.message || 'Health check failed',
          },
        },
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('movie/:movieId')
  async getMovieDetails(
    @Request() req,
    @Param('movieId') movieId: string,
    @Query('language') language?: string,
  ) {
    return this.recommendationsService.getMovieDetails(
      req.user.id,
      movieId,
      language || 'ru-RU',
    );
  }
}

