import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistoryService } from './history.service';
import { HistoryController } from './history.controller';
import { MovieHistory } from '../entities/movie-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MovieHistory])],
  controllers: [HistoryController],
  providers: [HistoryService],
})
export class HistoryModule {}

