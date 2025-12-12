import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
// Cache system removed
// import { CacheModule } from '@nestjs/cache-manager';
// import { redisStore } from 'cache-manager-redis-yet';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { HistoryModule } from './history/history.module';
import { WatchlistModule } from './watchlist/watchlist.module';
import { LoggerService } from './common/logger/logger.service';
// CacheService removed
import { CircuitBreakerService } from './common/circuit-breaker/circuit-breaker.service';
import { RECOMMENDATION_CONFIG } from './recommendations/constants/recommendation.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // CacheModule removed from project
    ThrottlerModule.forRoot([
      {
        ttl: RECOMMENDATION_CONFIG.RATE_LIMIT.WINDOW_MS,
        limit: RECOMMENDATION_CONFIG.RATE_LIMIT.MAX_REQUESTS,
      },
    ]),
    DatabaseModule,
    AuthModule,
    UsersModule,
    RecommendationsModule,
    HistoryModule,
    WatchlistModule,
  ],
  providers: [
    LoggerService,
    // CacheService removed
    CircuitBreakerService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [LoggerService, CircuitBreakerService],
})
export class AppModule { }

