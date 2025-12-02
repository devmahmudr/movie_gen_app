import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Watchlist } from '../entities/watchlist.entity';
import { AddToWatchlistDto } from './dto/add-to-watchlist.dto';

@Injectable()
export class WatchlistService {
  constructor(
    @InjectRepository(Watchlist)
    private watchlistRepository: Repository<Watchlist>,
  ) {}

  async findAll(userId: string): Promise<Watchlist[]> {
    return this.watchlistRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async add(userId: string, addToWatchlistDto: AddToWatchlistDto): Promise<Watchlist> {
    // Check if movie is already in watchlist
    const existing = await this.watchlistRepository.findOne({
      where: {
        userId,
        movieId: addToWatchlistDto.movieId,
      },
    });

    if (existing) {
      throw new ConflictException('Movie is already in watchlist');
    }

    const watchlistItem = this.watchlistRepository.create({
      userId,
      movieId: addToWatchlistDto.movieId,
      title: addToWatchlistDto.title,
      posterPath: addToWatchlistDto.posterPath,
    });

    return this.watchlistRepository.save(watchlistItem);
  }

  async remove(watchlistId: string, userId: string): Promise<void> {
    const watchlistItem = await this.watchlistRepository.findOne({
      where: { id: watchlistId },
    });

    if (!watchlistItem) {
      throw new NotFoundException('Watchlist item not found');
    }

    if (watchlistItem.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to remove this item',
      );
    }

    await this.watchlistRepository.remove(watchlistItem);
  }

  async removeByMovieId(movieId: string, userId: string): Promise<void> {
    const watchlistItem = await this.watchlistRepository.findOne({
      where: {
        userId,
        movieId,
      },
    });

    if (watchlistItem) {
      await this.watchlistRepository.remove(watchlistItem);
    }
  }
}

