-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR UNIQUE NOT NULL,
    password TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create movie_history table
CREATE TABLE IF NOT EXISTS movie_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "movieId" VARCHAR NOT NULL,
    title TEXT NOT NULL,
    "posterPath" TEXT,
    "userRating" INTEGER,
    "userFeedback" TEXT,
    "isWatched" BOOLEAN NOT NULL DEFAULT false,
    "isNotInterested" BOOLEAN NOT NULL DEFAULT false,
    "shownAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create watchlist table
CREATE TABLE IF NOT EXISTS watchlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "movieId" VARCHAR NOT NULL,
    title TEXT NOT NULL,
    "posterPath" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_movie_history_user_id ON movie_history("userId");
CREATE INDEX IF NOT EXISTS idx_movie_history_shown_at ON movie_history("shownAt");
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist("userId");

