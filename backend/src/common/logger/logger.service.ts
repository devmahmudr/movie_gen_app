import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger;
  private requestId: string | null = null;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: { service: 'movie-recommendation-api' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const requestId = meta.requestId || this.requestId || 'N/A';
              const metaStr = Object.keys(meta).length
                ? JSON.stringify(meta, null, 2)
                : '';
              return `[${timestamp}] [${requestId}] ${level}: ${message} ${metaStr}`;
            }),
          ),
        }),
      ],
    });
  }

  setRequestId(requestId: string) {
    this.requestId = requestId;
  }

  clearRequestId() {
    this.requestId = null;
  }

  log(message: string, context?: string, meta?: any) {
    this.logger.info(message, { context, ...meta, requestId: this.requestId });
  }

  error(message: string, trace?: string, context?: string, meta?: any) {
    this.logger.error(message, {
      trace,
      context,
      ...meta,
      requestId: this.requestId,
    });
  }

  warn(message: string, context?: string, meta?: any) {
    this.logger.warn(message, { context, ...meta, requestId: this.requestId });
  }

  debug(message: string, context?: string, meta?: any) {
    this.logger.debug(message, { context, ...meta, requestId: this.requestId });
  }

  verbose(message: string, context?: string, meta?: any) {
    this.logger.verbose(message, {
      context,
      ...meta,
      requestId: this.requestId,
    });
  }
}

