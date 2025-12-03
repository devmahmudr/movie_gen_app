import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WatchlistService } from './watchlist.service';
import { AddToWatchlistDto } from './dto/add-to-watchlist.dto';

@Controller('watchlist')
@UseGuards(JwtAuthGuard)
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get()
  async findAll(@Request() req) {
    return this.watchlistService.findAll(req.user.id);
  }

  @Post()
  async add(@Request() req, @Body() addToWatchlistDto: AddToWatchlistDto) {
    return this.watchlistService.add(req.user.id, addToWatchlistDto);
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    await this.watchlistService.remove(id, req.user.id);
    return { message: 'Removed from watchlist' };
  }

  @Delete('movie/:movieId')
  async removeByMovieId(@Request() req, @Param('movieId') movieId: string) {
    await this.watchlistService.removeByMovieId(movieId, req.user.id);
    return { message: 'Removed from watchlist' };
  }

  @Post('toggle')
  async toggle(@Request() req, @Body() addToWatchlistDto: AddToWatchlistDto) {
    return this.watchlistService.toggle(req.user.id, addToWatchlistDto);
  }
}

