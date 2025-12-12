import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';
import compression from 'compression';
import { randomUUID } from 'crypto';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: false, // We'll use our custom logger
  });

  const logger = app.get(LoggerService);
  app.useLogger(logger);

  // Enable CORS for mobile app with proper configuration
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  // Enable compression
  app.use(compression());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Add request ID tracking middleware
  app.use((req, res, next) => {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    req['requestId'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    
    logger.setRequestId(requestId);
    
    logger.log(`${req.method} ${req.path}`, 'HTTP', {
      origin: req.headers.origin || 'no-origin (mobile app)',
      'user-agent': req.headers['user-agent']?.substring(0, 50) || 'no-user-agent',
      'content-type': req.headers['content-type'] || 'no-content-type',
    });
    
    res.on('finish', () => {
      logger.clearRequestId();
    });
    
    next();
  });

  const port = process.env.PORT || 3000;
  const host = '0.0.0.0';
  await app.listen(port, host);

  logger.log(`Application is running on: http://${host}:${port}`, 'Bootstrap');
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`, 'Bootstrap');
  logger.log(`CORS: Enabled (allowing all origins for mobile apps)`, 'Bootstrap');
}
bootstrap();

