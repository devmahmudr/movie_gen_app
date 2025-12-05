import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for mobile app with proper configuration
  // Mobile apps (especially production builds) don't send standard web origins
  // They may send 'null' or no origin header, so we need to allow all origins
  // Since this is a mobile API (not a web API), we allow all origins
  // Authentication is handled via JWT tokens, not CORS
  app.enableCors({
    origin: true, // Allow all origins - mobile apps don't have same-origin restrictions
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Add request logging middleware for debugging
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`, {
      origin: req.headers.origin || 'no-origin (mobile app)',
      'user-agent': req.headers['user-agent']?.substring(0, 50) || 'no-user-agent',
      'content-type': req.headers['content-type'] || 'no-content-type',
    });
    next();
  });

  const port = process.env.PORT || 3000;
  const host = '0.0.0.0'; // Listen on all interfaces (required for Railway/cloud deployments)
  await app.listen(port, host);

  console.log(`Application is running on: http://${host}:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CORS: Enabled (allowing all origins for mobile apps)`);
}
bootstrap();

