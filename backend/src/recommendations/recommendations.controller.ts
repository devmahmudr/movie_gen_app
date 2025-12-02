import { Controller, Post, Get, Body, Request, UseGuards, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RecommendationsService } from './recommendations.service';
import { RecommendDto } from './dto';

@Controller('recommend')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async recommend(@Request() req, @Body() recommendDto: RecommendDto) {
    return this.recommendationsService.getRecommendations(
      req.user.id,
      recommendDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('movie/:movieId')
  async getMovieDetails(@Request() req, @Param('movieId') movieId: string) {
    return this.recommendationsService.getMovieDetails(req.user.id, movieId);
  }
}

