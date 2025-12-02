# 🚀 Quick Start with Docker

Get the entire stack running in 3 steps!

## Step 1: Setup Environment

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:
- `OPENAI_API_KEY` - Get from https://platform.openai.com/api-keys
- `TMDB_API_KEY` - Get from https://www.themoviedb.org/settings/api
- `JWT_SECRET` - Use a strong random string

## Step 2: Start Services

```bash
docker-compose up -d
```

Wait ~30 seconds for services to start, then check:

```bash
docker-compose ps
```

You should see:
- ✅ `movie-app-db` (postgres) - healthy
- ✅ `movie-app-backend` (backend) - running

## Step 3: Verify Backend

```bash
curl http://localhost:3000
```

Or check logs:
```bash
docker-compose logs backend
```

## Mobile App

The mobile app runs on your host machine (not in Docker):

```bash
cd mobile
npm install
npm start
```

**Important:** For physical devices, update `mobile/services/apiClient.ts` with your computer's IP instead of `localhost`.

## Common Issues

**Port already in use?**
- Change `BACKEND_PORT` or `DB_PORT` in `.env`

**Backend won't start?**
- Check logs: `docker-compose logs backend`
- Ensure API keys are set in `.env`
- Wait for database to be ready (healthcheck)

**Need to reset everything?**
```bash
docker-compose down -v
docker-compose up -d
```

## Useful Commands

```bash
# View logs
docker-compose logs -f backend

# Restart backend
docker-compose restart backend

# Stop everything
docker-compose down

# Access database
docker-compose exec postgres psql -U postgres -d movieapp
```

## Next Steps

- Read `DOCKER_SETUP.md` for detailed documentation
- Check `backend/API_DOCUMENTATION.md` for API endpoints
- See `mobile/README.md` for mobile app setup

🎉 You're all set!

