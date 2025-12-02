import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MovieHistory } from '../entities/movie-history.entity';
import { UpdateHistoryDto } from './dto';

@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(MovieHistory)
    private movieHistoryRepository: Repository<MovieHistory>,
  ) {}

  async findAll(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: MovieHistory[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.movieHistoryRepository.findAndCount({
      where: { userId },
      order: { shownAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async update(
    historyId: string,
    userId: string,
    updateHistoryDto: UpdateHistoryDto,
  ): Promise<MovieHistory> {
    const history = await this.movieHistoryRepository.findOne({
      where: { id: historyId },
    });

    if (!history) {
      throw new NotFoundException('History record not found');
    }

    // Ensure the history belongs to the authenticated user
    if (history.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this record',
      );
    }

    // Update only provided fields
    if (updateHistoryDto.userRating !== undefined) {
      history.userRating = updateHistoryDto.userRating;
    }

    if (updateHistoryDto.userFeedback !== undefined) {
      history.userFeedback = updateHistoryDto.userFeedback;
    }

    return this.movieHistoryRepository.save(history);
  }

  async toggleWatched(
    historyId: string,
    userId: string,
  ): Promise<MovieHistory> {
    const history = await this.movieHistoryRepository.findOne({
      where: { id: historyId },
    });

    if (!history) {
      throw new NotFoundException('History record not found');
    }

    if (history.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this record',
      );
    }

    // Toggle the watched status
    history.isWatched = !history.isWatched;
    return this.movieHistoryRepository.save(history);
  }

  async toggleNotInterested(
    historyId: string,
    userId: string,
  ): Promise<MovieHistory> {
    const history = await this.movieHistoryRepository.findOne({
      where: { id: historyId },
    });

    if (!history) {
      throw new NotFoundException('History record not found');
    }

    if (history.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this record',
      );
    }

    // Toggle the not interested status
    history.isNotInterested = !history.isNotInterested;
    return this.movieHistoryRepository.save(history);
  }
}

