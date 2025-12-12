/**
 * Test Script: Verify Movie Details Isolation
 * 
 * This script tests that each movie gets unique data from TMDb API
 * and that there's no data duplication between parallel requests.
 * 
 * Run with: npx ts-node backend/test-movie-details-isolation.ts
 * 
 * Make sure TMDB_API_KEY is set in your .env file or environment variables
 */

import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env file
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // Try parent directory
  const parentEnvPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(parentEnvPath)) {
    dotenv.config({ path: parentEnvPath });
  }
}

// Test movie IDs that should have different data
const TEST_MOVIE_IDS = [
  '1363123',  // Семейный план 2 (2025)
  '1248226',  // Убойная суббота (different movie)
  '1161617',  // Код 3 (different movie)
];

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

interface MovieDetails {
  movieId: string;
  title: string;
  releaseYear?: string;
  country?: string;
  runtime?: number;
  imdbRating?: number;
  ageRating?: string;
  genres: string[];
  overview?: string;
}

async function getMovieDetails(
  movieId: string,
  language: string = 'ru-RU',
): Promise<MovieDetails | null> {
  try {
    const movieUrl = `${TMDB_BASE_URL}/movie/${movieId}`;
    const response = await axios.get(movieUrl, {
      params: {
        api_key: TMDB_API_KEY,
        language: language,
        append_to_response: 'external_ids,release_dates',
      },
      timeout: 5000,
    });

    const data = response.data;
    if (!data || !data.id || data.id.toString() !== movieId) {
      console.error(`❌ ERROR: Response movieId (${data?.id}) does not match requested (${movieId})`);
      return null;
    }
    
    const genres = data.genres?.map((g: any) => g.name) || [];
    const overview = data.overview || '';
    const country = data.production_countries?.[0]?.name || '';
    const runtime = data.runtime || undefined;
    const releaseYear = data.release_date ? data.release_date.split('-')[0] : '';
    
    // Get age rating
    let ageRating: string | undefined;
    try {
      const releaseDates = data.release_dates?.results || [];
      const usCertToAge: { [key: string]: string } = {
        'G': '0+', 'PG': '7+', 'PG-13': '13+', 'R': '18+', 'NC-17': '18+',
      };
      const numericRatingCountries = ['RU', 'DE', 'FR', 'GB', 'ES', 'IT', 'NL', 'BE', 'PL', 'CZ', 'SE', 'NO', 'DK', 'FI'];
      
      for (const countryCode of numericRatingCountries) {
        const countryRelease = releaseDates.find((r: any) => r.iso_3166_1 === countryCode);
        const cert = countryRelease?.release_dates?.find((rd: any) => rd.certification)?.certification;
        if (cert && (/^\d+\+?$/.test(cert) || cert.includes('+'))) {
          ageRating = cert.includes('+') ? cert : `${cert}+`;
          break;
        }
      }
      
      if (!ageRating) {
        const usRelease = releaseDates.find((r: any) => r.iso_3166_1 === 'US');
        const usCert = usRelease?.release_dates?.find((rd: any) => rd.certification)?.certification;
        if (usCert && usCertToAge[usCert]) {
          ageRating = usCertToAge[usCert];
        }
      }
    } catch (certError) {
      // Ignore
    }
    
    // Get IMDb rating
    const imdbId = data.external_ids?.imdb_id;
    let imdbRating: number | undefined;
    
    if (imdbId && process.env.OMDB_API_KEY) {
      try {
        const omdbResponse = await axios.get(`http://www.omdbapi.com/`, {
          params: { i: imdbId, apikey: process.env.OMDB_API_KEY },
          timeout: 3000,
        });
        if (omdbResponse.data?.imdbRating && omdbResponse.data.imdbRating !== 'N/A') {
          imdbRating = parseFloat(omdbResponse.data.imdbRating);
        }
      } catch (e) {
        // Fallback to TMDb rating
      }
    }
    
    if (imdbRating === undefined && data.vote_average) {
      imdbRating = parseFloat(data.vote_average.toFixed(1));
    }

    return {
      movieId,
      title: data.title,
      releaseYear,
      country,
      runtime,
      imdbRating,
      ageRating,
      genres,
      overview: overview.substring(0, 100) + '...',
    };
  } catch (error: any) {
    console.error(`❌ Failed to get details for ${movieId}:`, error.message);
    return null;
  }
}

async function testIsolatedScopes() {
  console.log('🧪 Testing Movie Details Isolation\n');
  console.log('='.repeat(80));
  
  if (!TMDB_API_KEY) {
    console.error('❌ TMDB_API_KEY is not set in environment variables');
    process.exit(1);
  }
  
  console.log(`📋 Testing ${TEST_MOVIE_IDS.length} movies in parallel...\n`);
  
  // Test 1: Sequential requests (baseline)
  console.log('📌 Test 1: Sequential Requests (Baseline)');
  console.log('-'.repeat(80));
  const sequentialResults: (MovieDetails | null)[] = [];
  for (const movieId of TEST_MOVIE_IDS) {
    const details = await getMovieDetails(movieId);
    sequentialResults.push(details);
    if (details) {
      console.log(`✅ ${details.movieId}: ${details.title}`);
      console.log(`   Year: ${details.releaseYear}, Country: ${details.country}, Runtime: ${details.runtime}min`);
      console.log(`   IMDb: ${details.imdbRating}, Age: ${details.ageRating}, Genres: ${details.genres.join(', ')}`);
    }
  }
  console.log('');
  
  // Test 2: Parallel requests (simulating the actual code)
  console.log('📌 Test 2: Parallel Requests (Simulating Isolated Scopes)');
  console.log('-'.repeat(80));
  
  const parallelPromises = TEST_MOVIE_IDS.map(async (movieId) => {
    // Each promise has its own isolated scope with const movieDetails
    const movieDetails = await getMovieDetails(movieId);
    return { movieId, movieDetails };
  });
  
  const parallelResults = await Promise.all(parallelPromises);
  
  for (const { movieId, movieDetails } of parallelResults) {
    if (movieDetails) {
      console.log(`✅ ${movieDetails.movieId}: ${movieDetails.title}`);
      console.log(`   Year: ${movieDetails.releaseYear}, Country: ${movieDetails.country}, Runtime: ${movieDetails.runtime}min`);
      console.log(`   IMDb: ${movieDetails.imdbRating}, Age: ${movieDetails.ageRating}, Genres: ${movieDetails.genres.join(', ')}`);
    } else {
      console.log(`❌ ${movieId}: Failed to get details`);
    }
  }
  console.log('');
  
  // Test 3: Verify uniqueness
  console.log('📌 Test 3: Verifying Data Uniqueness');
  console.log('-'.repeat(80));
  
  const validResults = parallelResults
    .map(r => r.movieDetails)
    .filter((d): d is MovieDetails => d !== null);
  
  if (validResults.length !== TEST_MOVIE_IDS.length) {
    console.error(`❌ FAILED: Only got ${validResults.length} out of ${TEST_MOVIE_IDS.length} movies`);
    process.exit(1);
  }
  
  // Check for duplicates
  const seenData = new Map<string, string[]>();
  let hasDuplicates = false;
  
  for (const movie of validResults) {
    const dataKey = `${movie.releaseYear}|${movie.runtime}|${movie.imdbRating}|${movie.country}|${movie.ageRating}`;
    if (seenData.has(dataKey)) {
      const existing = seenData.get(dataKey)!;
      console.error(`❌ DUPLICATE DATA DETECTED!`);
      console.error(`   Movie ${movie.movieId} (${movie.title}) has same data as: ${existing.join(', ')}`);
      console.error(`   Data: Year=${movie.releaseYear}, Runtime=${movie.runtime}, IMDb=${movie.imdbRating}, Country=${movie.country}, Age=${movie.ageRating}`);
      hasDuplicates = true;
    } else {
      seenData.set(dataKey, [movie.movieId]);
    }
  }
  
  if (hasDuplicates) {
    console.error('\n❌ TEST FAILED: Duplicate data detected between movies!');
    process.exit(1);
  }
  
  // Verify each movie has unique data
  const uniqueYears = new Set(validResults.map(m => m.releaseYear));
  const uniqueRuntimes = new Set(validResults.map(m => m.runtime));
  const uniqueCountries = new Set(validResults.map(m => m.country));
  
  console.log(`✅ All ${validResults.length} movies have unique data:`);
  console.log(`   - Unique years: ${uniqueYears.size}`);
  console.log(`   - Unique runtimes: ${uniqueRuntimes.size}`);
  console.log(`   - Unique countries: ${uniqueCountries.size}`);
  console.log('');
  
  // Test 4: Compare sequential vs parallel results
  console.log('📌 Test 4: Comparing Sequential vs Parallel Results');
  console.log('-'.repeat(80));
  
  let allMatch = true;
  for (let i = 0; i < sequentialResults.length; i++) {
    const seq = sequentialResults[i];
    const par = parallelResults[i].movieDetails;
    
    if (seq && par) {
      const match = 
        seq.movieId === par.movieId &&
        seq.releaseYear === par.releaseYear &&
        seq.runtime === par.runtime &&
        seq.country === par.country &&
        seq.imdbRating === par.imdbRating;
      
      if (!match) {
        console.error(`❌ Mismatch for movie ${seq.movieId}:`);
        console.error(`   Sequential: Year=${seq.releaseYear}, Runtime=${seq.runtime}, Country=${seq.country}, IMDb=${seq.imdbRating}`);
        console.error(`   Parallel:   Year=${par.releaseYear}, Runtime=${par.runtime}, Country=${par.country}, IMDb=${par.imdbRating}`);
        allMatch = false;
      } else {
        console.log(`✅ Movie ${seq.movieId}: Sequential and parallel results match`);
      }
    }
  }
  
  console.log('');
  console.log('='.repeat(80));
  
  if (allMatch && !hasDuplicates) {
    console.log('✅ ALL TESTS PASSED!');
    console.log('   ✓ Each movie gets unique data');
    console.log('   ✓ No data duplication between movies');
    console.log('   ✓ Isolated scopes working correctly');
    console.log('   ✓ Parallel and sequential results match');
    process.exit(0);
  } else {
    console.error('❌ TESTS FAILED!');
    process.exit(1);
  }
}

// Run the test
testIsolatedScopes().catch((error) => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});
