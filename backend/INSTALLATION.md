# Installation Guide

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and fill in your configuration:

```env
# Database Configuration (for Supabase PostgreSQL)
DATABASE_URL=postgresql://username:password@db.xxxxx.supabase.co:5432/postgres

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRATION_TIME=24h

# OpenAI Configuration
OPENAI_API_KEY=sk-...

# TMDb Configuration
TMDB_API_KEY=your-tmdb-api-key
TMDB_BASE_URL=https://api.themoviedb.org/3
```

### Getting API Keys:

1. **TMDb API Key**: 
   - Go to https://www.themoviedb.org/settings/api
   - Request an API key
   - Copy your API key to `.env`

2. **OpenAI API Key**:
   - Go to https://platform.openai.com/api-keys
   - Create a new API key
   - Copy it to `.env`

3. **Database URL (Supabase)**:
   - In your Supabase dashboard, go to Settings > Database
   - Copy the connection string
   - Format: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

## Step 3: Set Up Database

### Option A: Using Supabase (Recommended)

1. Create a new Supabase project at https://supabase.com
2. Go to SQL Editor
3. Run the following SQL to create the tables:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR UNIQUE NOT NULL,
    password TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create movie_history table
CREATE TABLE movie_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "movieId" VARCHAR NOT NULL,
    title TEXT NOT NULL,
    "posterPath" TEXT,
    "userRating" INTEGER,
    "userFeedback" TEXT,
    "shownAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create watchlist table
CREATE TABLE watchlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "movieId" VARCHAR NOT NULL,
    title TEXT NOT NULL,
    "posterPath" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_movie_history_user_id ON movie_history("userId");
CREATE INDEX idx_movie_history_shown_at ON movie_history("shownAt");
CREATE INDEX idx_watchlist_user_id ON watchlist("userId");
```

### Option B: Using TypeORM Migrations

If you prefer using migrations:

```bash
# Generate migration (after setting up entities)
npm run migration:generate -- src/database/migrations/InitialMigration

# Run migrations
npm run migration:run
```

## Step 4: Start the Application

### Development mode:
```bash
npm run start:dev
```

### Production mode:
```bash
npm run build
npm run start:prod
```

The application will start on `http://localhost:3000` (or the port specified in your `.env` file).

## Step 5: Test the API

You can test the endpoints using tools like Postman or curl:

### Register a new user:
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

### Login:
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

Save the `accessToken` from the response and use it as a Bearer token for protected routes.

## Troubleshooting

1. **Database connection errors**: 
   - Verify your `DATABASE_URL` is correct
   - Check if your database allows connections from your IP

2. **OpenAI API errors**:
   - Verify your API key is correct
   - Check your OpenAI account has credits
   - The model name might need to be adjusted based on your OpenAI plan

3. **TMDb API errors**:
   - Verify your TMDb API key is correct
   - Check TMDb API status

