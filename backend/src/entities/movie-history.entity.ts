import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('movie_history')
export class MovieHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.movieHistory)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar' })
  movieId: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  posterPath: string;

  @Column({ type: 'integer', nullable: true })
  userRating: number;

  @Column({ type: 'text', nullable: true })
  userFeedback: string;

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  shownAt: Date;

  @Column({ type: 'boolean', default: false })
  isWatched: boolean;

  @Column({ type: 'boolean', default: false })
  isNotInterested: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}

