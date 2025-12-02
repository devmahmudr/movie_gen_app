import {
  IsEnum,
  IsArray,
  IsString,
  IsOptional,
  ArrayMaxSize,
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
  BOTH = 'Оба',
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
  similarTo?: string;

  @IsEnum(FormatEnum)
  format: FormatEnum;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeIds?: string[]; // The TMDb movie IDs to exclude
}

