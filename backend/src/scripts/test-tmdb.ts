
import { config } from 'dotenv';
import axios from 'axios';
import { resolve } from 'path';

// Load .env from backend root
config({ path: resolve(__dirname, '../../.env') });

async function testTMDb() {
    const apiKey = process.env.TMDB_API_KEY;
    const baseUrl = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';

    console.log('Testing TMDb API...');
    console.log(`Base URL: ${baseUrl}`);
    console.log(`API Key present: ${!!apiKey}`);

    if (!apiKey) {
        console.error('ERROR: TMDB_API_KEY is missing in .env');
        return;
    }

    const moviesToTest = [
        { title: 'Minecraft', year: 2025 },
        { title: 'Code 3', year: 2025 },
        { title: 'Inception', year: 2010 }
    ];

    for (const requested of moviesToTest) {
        console.log(`\n----------------------------------------`);
        console.log(`Searching for: ${requested.title} (${requested.year})`);

        try {
            // 1. Search
            const searchUrl = `${baseUrl}/search/movie`;
            const searchParams = {
                api_key: apiKey,
                query: requested.title,
                language: 'ru-RU',
                year: requested.year,
            };

            const searchRes = await axios.get(searchUrl, { params: searchParams });

            if (!searchRes.data.results || searchRes.data.results.length === 0) {
                console.log('❌ No results found (search)');
                continue;
            }

            const movie = searchRes.data.results[0];
            console.log(`✅ Found: ${movie.title} (ID: ${movie.id})`);
            console.log(`   Search Result Overview: ${movie.overview?.substring(0, 50)}...`);

            // 2. Details
            const detailsUrl = `${baseUrl}/movie/${movie.id}`;
            const detailsParams = {
                api_key: apiKey,
                language: 'ru-RU',
                append_to_response: 'release_dates'
            };

            const detailsRes = await axios.get(detailsUrl, { params: detailsParams });
            const details = detailsRes.data;

            console.log(`\n📋 Details for ID ${movie.id}:`);
            console.log(`   Title: ${details.title}`);
            console.log(`   Original Title: ${details.original_title}`);
            console.log(`   Runtime: ${details.runtime} minutes`);
            console.log(`   Release Date: ${details.release_date}`);
            console.log(`   Vote Average: ${details.vote_average}`);
            console.log(`   Vote Count: ${details.vote_count}`);
            console.log(`   Genres: ${details.genres?.map((g: any) => g.name).join(', ')}`);
            console.log(`   Countries: ${details.production_countries?.map((c: any) => c.name).join(', ')}`);

        } catch (error: any) {
            console.error(`❌ Error: ${error.message}`);
            if (error.response) {
                console.error(`   Status: ${error.response.status}`);
                console.error(`   Data:`, error.response.data);
            }
        }
    }
}

testTMDb();
