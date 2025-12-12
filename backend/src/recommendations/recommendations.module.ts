import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { TerminusModule } from '@nestjs/terminus';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { OpenAIService } from './services/openai.service';
import { TMDbService } from './services/tmdb.service';
import { MovieHistory } from '../entities/movie-history.entity';
import { LoggerService } from '../common/logger/logger.service';
// CacheService removed
import { CircuitBreakerService } from '../common/circuit-breaker/circuit-breaker.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MovieHistory]),
    HttpModule,
    TerminusModule,
  ],
  controllers: [RecommendationsController],
  providers: [
    RecommendationsService,
    OpenAIService,
    TMDbService,
    LoggerService,
    // CacheService removed
    CircuitBreakerService,
  ],
  exports: [RecommendationsService],
})
export class RecommendationsModule { }

