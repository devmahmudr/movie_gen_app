import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AddToWatchlistDto {
  @IsString()
  @IsNotEmpty()
  movieId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  posterPath?: string;
}

