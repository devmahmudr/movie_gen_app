import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { OpenAIService } from './services/openai.service';
import { TMDbService } from './services/tmdb.service';
import { MovieHistory } from '../entities/movie-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MovieHistory]), HttpModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService, OpenAIService, TMDbService],
})
export class RecommendationsModule {}

