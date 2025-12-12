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

  async rateMovie(
    historyId: string,
    userId: string,
    rating: number,
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

    // Validate rating
    if (rating < 1 || rating > 10) {
      throw new Error('Rating must be between 1 and 10');
    }

    // Set rating and mark as watched (since user rated it, they've watched it)
    history.userRating = rating;
    history.isWatched = true;
    return this.movieHistoryRepository.save(history);
  }

  async getAverageRating(movieId: string): Promise<{ average: number; count: number } | null> {
    const result = await this.movieHistoryRepository
      .createQueryBuilder('history')
      .select('AVG(history.userRating)', 'average')
      .addSelect('COUNT(history.userRating)', 'count')
      .where('history.movieId = :movieId', { movieId })
      .andWhere('history.userRating IS NOT NULL')
      .getRawOne();

    if (!result || !result.average) {
      return null;
    }

    return {
      average: parseFloat(result.average),
      count: parseInt(result.count, 10),
    };
  }

  async getMovieRatings(movieId: string): Promise<{ rating: number; count: number }[]> {
    const results = await this.movieHistoryRepository
      .createQueryBuilder('history')
      .select('history.userRating', 'rating')
      .addSelect('COUNT(*)', 'count')
      .where('history.movieId = :movieId', { movieId })
      .andWhere('history.userRating IS NOT NULL')
      .groupBy('history.userRating')
      .orderBy('history.userRating', 'DESC')
      .getRawMany();

    return results.map((r) => ({
      rating: r.rating,
      count: parseInt(r.count, 10),
    }));
  }
}

