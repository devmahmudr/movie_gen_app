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

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();

