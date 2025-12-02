# Movie Recommendation App Backend

Backend API for a movie recommendation mobile application built with NestJS, PostgreSQL, TypeORM, and OpenAI integration.

## Features

- JWT-based authentication
- User registration and login
- Personalized movie recommendations using OpenAI
- Movie history tracking
- Watchlist functionality
- Integration with TMDb API for movie data

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- OpenAI API key
- TMDb API key

## Installation

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your configuration:
```bash
cp .env.example .env
```

3. Update `.env` with your:
   - Database connection string
   - JWT secret
   - OpenAI API key
   - TMDb API key

## Running the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user

### User
- `GET /users/me` - Get current user profile (Protected)

### Recommendations
- `POST /recommend` - Get movie recommendations (Protected)

### History
- `GET /history` - Get user's movie history (Protected)
- `PUT /history/:historyId` - Update movie history entry (Protected)

## Database Setup

The application uses TypeORM migrations. To set up the database:

```bash
# Generate migration (after creating entities)
npm run migration:generate -- src/database/migrations/InitialMigration

# Run migrations
npm run migration:run
```

