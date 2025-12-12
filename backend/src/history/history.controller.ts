import {
  Controller,
  Get,
  Put,
  Patch,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HistoryService } from './history.service';
import { UpdateHistoryDto } from './dto';

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.historyService.findAll(req.user.id, page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':historyId')
  async update(
    @Request() req,
    @Param('historyId') historyId: string,
    @Body() updateHistoryDto: UpdateHistoryDto,
  ) {
    return this.historyService.update(historyId, req.user.id, updateHistoryDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':historyId/watched')
  async toggleWatched(
    @Request() req,
    @Param('historyId') historyId: string,
  ) {
    return this.historyService.toggleWatched(historyId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':historyId/not-interested')
  async toggleNotInterested(
    @Request() req,
    @Param('historyId') historyId: string,
  ) {
    return this.historyService.toggleNotInterested(historyId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':historyId/rating')
  async rateMovie(
    @Request() req,
    @Param('historyId') historyId: string,
    @Body('rating', ParseIntPipe) rating: number,
  ) {
    if (rating < 1 || rating > 10) {
      throw new Error('Rating must be between 1 and 10');
    }
    return this.historyService.rateMovie(historyId, req.user.id, rating);
  }

  @Get('movie/:movieId/rating')
  async getAverageRating(@Param('movieId') movieId: string) {
    return this.historyService.getAverageRating(movieId);
  }

  @Get('movie/:movieId/ratings')
  async getMovieRatings(@Param('movieId') movieId: string) {
    return this.historyService.getMovieRatings(movieId);
  }
}

