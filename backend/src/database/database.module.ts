import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User, MovieHistory, Watchlist } from '../entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [User, MovieHistory, Watchlist],
        synchronize: false, // Use migrations in production
        logging: configService.get<string>('NODE_ENV') === 'development',
        // Connection pool settings for better reliability
        extra: {
          max: 10, // Maximum number of connections in the pool
          min: 2, // Minimum number of connections in the pool
          idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
          connectionTimeoutMillis: 5000, // Wait 5 seconds before timing out when connecting
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}

