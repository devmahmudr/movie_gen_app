import { DataSource } from 'typeorm';
import { User, MovieHistory, Watchlist } from '../entities';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env file explicitly for TypeORM CLI commands
// This is needed because TypeORM CLI doesn't automatically load .env files
const envPath = resolve(process.cwd(), '.env');
const result = config({ path: envPath });

if (result.error && !process.env.DATABASE_URL) {
  console.warn('Warning: Could not load .env file. Make sure .env exists in the project root.');
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not defined. Please check your .env file and ensure DATABASE_URL is set.',
  );
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, MovieHistory, Watchlist],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false, // Use migrations in production
  logging: process.env.NODE_ENV === 'development',
});

