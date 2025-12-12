import {
  IsEnum,
  IsArray,
  IsString,
  IsOptional,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';

export enum ContextEnum {
  ALONE = 'Один',
  WITH_PARTNER = 'С девушкой/парнем',
  WITH_FRIENDS = 'С друзьями',
  WITH_FAMILY = 'С семьёй',
  BACKGROUND = 'Хочу фоновый фильм',
}

export enum FormatEnum {
  MOVIE = 'Фильм',
  SERIES = 'Сериал',
  CARTOON = 'Мультфильм',
  ANY = 'Не важно',
}

export class RecommendDto {
  @IsEnum(ContextEnum)
  context: ContextEnum;

  @IsArray()
  @ArrayMaxSize(2)
  @IsString({ each: true })
  moods: string[];

  @IsArray()
  @ArrayMaxSize(2)
  @IsString({ each: true })
  tags: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'similarTo must not exceed 500 characters' })
  similarTo?: string;

  @IsEnum(FormatEnum)
  format: FormatEnum;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeIds?: string[]; // The TMDb movie IDs to exclude

  @IsOptional()
  @IsString()
  language?: string; // Language code (e.g., 'ru-RU', 'en-US'), defaults to 'ru-RU'
}

