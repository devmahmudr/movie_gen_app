# Movie Recommendation App

A full-stack movie recommendation application with NestJS backend and React Native (Expo) mobile frontend.

## Project Structure

```
movie_app/
├── backend/          # NestJS API server
├── mobile/           # React Native (Expo) mobile app
├── docker-compose.yml # Docker orchestration
└── .env              # Environment variables (create from .env.example)
```

## Quick Start with Docker (Recommended)

The easiest way to get started is using Docker, which solves Node.js version conflicts and provides a consistent environment.

### Prerequisites

- Docker Desktop installed and running
- API keys for OpenAI and TMDb

### Setup Steps

1. **Clone and navigate to project:**
   ```bash
   cd movie_app
   ```

2. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` and add your API keys:**
   ```env
   OPENAI_API_KEY=sk-your-key-here
   TMDB_API_KEY=your-tmdb-key-here
   JWT_SECRET=your-secret-key-here
   ```

4. **Start all services:**
   ```bash
   docker-compose up -d
   ```
   
   Or using Make:
   ```bash
   make up
   ```

5. **Check services are running:**
   ```bash
   docker-compose ps
   # or
   make status
   ```

6. **View backend logs:**
   ```bash
   docker-compose logs -f backend
   # or
   make logs-backend
   ```

The backend will be available at `http://localhost:3000`

### Mobile App Setup

1. **Navigate to mobile directory:**
   ```bash
   cd mobile
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start Expo:**
   ```bash
   npm start
   ```

4. **For physical devices:** Update `mobile/services/apiClient.ts` to use your computer's IP address instead of `localhost`.

## Manual Setup (Without Docker)

### Backend Setup

1. **Navigate to backend:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up database:**
   - Use Supabase (see `backend/INSTALLATION.md`)
   - Or run PostgreSQL locally

5. **Start backend:**
   ```bash
   npm run start:dev
   ```

### Mobile Setup

1. **Navigate to mobile:**
   ```bash
   cd mobile
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Update API URL** in `services/apiClient.ts` if needed

4. **Start Expo:**
   ```bash
   npm start
   ```

## Available Commands

### Docker Commands

```bash
# Start all services
make up
# or
docker-compose up -d

# Stop all services
make down
# or
docker-compose down

# View logs
make logs
make logs-backend
make logs-db

# Restart services
make restart
make restart-backend

# Rebuild after code changes
make rebuild

# Clean everything (removes volumes)
make clean

# Access database shell
make db-shell

# Access backend shell
make backend-shell

# Run migrations
make migrate

# Run tests
make test
```

## API Documentation

See `backend/API_DOCUMENTATION.md` for complete API reference.

## Environment Variables

Key environment variables (see `.env.example`):

- `DB_USER` - PostgreSQL username (default: postgres)
- `DB_PASSWORD` - PostgreSQL password (default: postgres)
- `DB_NAME` - Database name (default: movieapp)
- `BACKEND_PORT` - Backend port (default: 3000)
- `JWT_SECRET` - JWT signing secret (required)
- `OPENAI_API_KEY` - OpenAI API key (required)
- `TMDB_API_KEY` - TMDb API key (required)

## Architecture

```
┌─────────────────┐
│   Mobile App    │  (Expo - runs on host)
│   React Native  │
└────────┬────────┘
         │ HTTP
         │
┌────────▼────────┐
│   Backend       │  (Docker - NestJS)
│   Port: 3000    │
└────────┬────────┘
         │
         │ PostgreSQL
         │
┌────────▼────────┐
│   PostgreSQL    │  (Docker)
│   Port: 5432    │
└─────────────────┘
```

## Getting API Keys

1. **TMDb API Key:**
   - Visit https://www.themoviedb.org/settings/api
   - Request an API key
   - Copy to `.env`

2. **OpenAI API Key:**
   - Visit https://platform.openai.com/api-keys
   - Create a new API key
   - Copy to `.env`

## Troubleshooting

### Docker Issues

- **Port conflicts:** Change ports in `.env`
- **Services won't start:** Check logs with `make logs`
- **Database connection errors:** Wait a few seconds for DB to be ready

### Mobile App Issues

- **Can't connect to backend:** 
  - For simulator: Use `localhost:3000`
  - For physical device: Use your computer's IP address
- **Node.js version:** Use Node.js 18 or 20 (see `mobile/README_NODE_VERSION.md`)

## Development

- Backend auto-reloads on code changes (development mode)
- Database is automatically initialized with required tables
- All services are on the same Docker network for easy communication

## Production

For production deployment, see `DOCKER_SETUP.md` for production considerations.

## License

MIT

