# 🚀 Deployment Guide

Complete guide to deploy the Movie App backend to Railway and mobile app to Expo Cloud.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Backend Deployment (Railway)](#backend-deployment-railway)
3. [Mobile App Deployment (Expo Cloud)](#mobile-app-deployment-expo-cloud)
4. [Post-Deployment Configuration](#post-deployment-configuration)
5. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- ✅ GitHub account
- ✅ Railway account (sign up at https://railway.app)
- ✅ Expo account (sign up at https://expo.dev)
- ✅ API keys ready:
  - OpenAI API key
  - TMDb API key
- ✅ Node.js installed locally (for building)

---

## Backend Deployment (Railway)

### Step 1: Prepare GitHub Repository

1. **Initialize Git repository** (if not already done):
   ```bash
   cd /Users/mahmudzon/Desktop/movie_app
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Create GitHub repository**:
   - Go to https://github.com/new
   - Create a new repository (e.g., `movie-app`)
   - **Don't** initialize with README, .gitignore, or license

3. **Push to GitHub**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/movie-app.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Prepare Backend for Railway

1. **Create Railway-specific files**:

   Create `backend/railway.json`:
   ```json
   {
     "$schema": "https://railway.app/railway.schema.json",
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "startCommand": "npm run start:prod",
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 10
     }
   }
   ```

2. **Update `backend/package.json`** to ensure production script exists:
   ```json
   "scripts": {
     "start:prod": "node dist/main",
     "build": "nest build",
     "postbuild": "npm run migration:run"
   }
   ```

3. **Create `backend/Procfile`** (alternative to railway.json):
   ```
   release: npm run migration:run
   web: npm run start:prod
   ```

### Step 3: Deploy to Railway

1. **Create new project on Railway**:
   - Go to https://railway.app
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Authorize Railway to access your GitHub
   - Select your repository

2. **Add PostgreSQL Database**:
   - In your Railway project, click "+ New"
   - Select "Database" → "Add PostgreSQL"
   - Railway will automatically create a PostgreSQL service

3. **Configure Backend Service**:
   - Railway should auto-detect your backend
   - If not, click "+ New" → "GitHub Repo" → Select your repo
   - Set root directory to `backend`

4. **Set Environment Variables**:
   - Click on your backend service
   - Go to "Variables" tab
   - Add the following variables:

   ```
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   JWT_SECRET=your-super-secret-jwt-key-change-this-to-random-string
   JWT_EXPIRATION_TIME=24h
   OPENAI_API_KEY=sk-your-openai-key-here
   TMDB_API_KEY=your-tmdb-key-here
   TMDB_BASE_URL=https://api.themoviedb.org/3
   ```

   **Important**: 
   - For `DATABASE_URL`, use the reference variable: `${{Postgres.DATABASE_URL}}`
   - Replace `JWT_SECRET` with a strong random string
   - Add your actual API keys

5. **Configure Build Settings**:
   - Go to "Settings" → "Build"
   - Build command: `npm ci && npm run build`
   - Start command: `npm run start:prod`

6. **Deploy**:
   - Railway will automatically deploy when you push to GitHub
   - Or click "Deploy" button to trigger manual deployment
   - Wait for build to complete (check "Deployments" tab)

7. **Get your backend URL**:
   - After deployment, Railway will provide a URL like: `https://your-app.up.railway.app`
   - Copy this URL - you'll need it for the mobile app

### Step 4: Run Database Migrations

1. **Access Railway CLI** (optional):
   ```bash
   npm install -g @railway/cli
   railway login
   railway link
   railway run npm run migration:run
   ```

2. **Or use Railway dashboard**:
   - Go to your backend service
   - Click "Deployments" → Latest deployment
   - Click "View Logs" to see migration output

---

## Mobile App Deployment (Expo Cloud)

### Step 1: Install Expo CLI

```bash
npm install -g expo-cli
# or
npm install -g @expo/cli
```

### Step 2: Login to Expo

```bash
cd mobile
expo login
# Enter your Expo credentials
```

### Step 3: Update API Configuration

1. **Update `mobile/services/apiClient.ts`**:
   - Replace `localhost:3000` with your Railway backend URL
   - Example: `https://your-app.up.railway.app`

2. **Create `mobile/.env`** (optional, for local development):
   ```env
   EXPO_PUBLIC_API_URL=https://your-app.up.railway.app
   ```

### Step 4: Configure app.json

1. **Update `mobile/app.json`**:
   ```json
   {
     "expo": {
       "name": "Movie App",
       "slug": "movie-app",
       "version": "1.0.0",
       "orientation": "portrait",
       "userInterfaceStyle": "dark",
       "splash": {
         "resizeMode": "contain",
         "backgroundColor": "#000000"
       },
       "ios": {
         "supportsTablet": true,
         "bundleIdentifier": "com.yourcompany.movieapp"
       },
       "android": {
         "adaptiveIcon": {
           "backgroundColor": "#000000"
         },
         "package": "com.yourcompany.movieapp"
       },
       "scheme": "movieapp",
       "plugins": [
         "expo-router"
       ],
       "extra": {
         "apiUrl": "https://your-app.up.railway.app"
       }
     }
   }
   ```

### Step 5: Build and Deploy

1. **Build for development** (Expo Go):
   ```bash
   cd mobile
   expo start
   ```
   - Scan QR code with Expo Go app on your phone
   - Or press `i` for iOS simulator, `a` for Android emulator

2. **Build for production** (EAS Build):

   Install EAS CLI:
   ```bash
   npm install -g eas-cli
   eas login
   ```

   Configure EAS:
   ```bash
   cd mobile
   eas build:configure
   ```

   Build for iOS:
   ```bash
   eas build --platform ios
   ```

   Build for Android:
   ```bash
   eas build --platform android
   ```

   Build for both:
   ```bash
   eas build --platform all
   ```

3. **Submit to App Stores** (optional):

   iOS (App Store):
   ```bash
   eas submit --platform ios
   ```

   Android (Google Play):
   ```bash
   eas submit --platform android
   ```

### Step 6: Update API Client to Use Environment Variable

Update `mobile/services/apiClient.ts` to read from environment:

```typescript
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://your-app.up.railway.app';
```

---

## Post-Deployment Configuration

### Backend (Railway)

1. **Set up Custom Domain** (optional):
   - Go to Railway project → Backend service → Settings
   - Add custom domain
   - Update DNS records as instructed

2. **Monitor Logs**:
   - Railway dashboard → Backend service → Logs
   - Or use: `railway logs`

3. **Database Backups**:
   - Railway provides automatic backups for PostgreSQL
   - Check "Database" service → "Backups" tab

### Mobile App (Expo)

1. **Update API URL**:
   - Ensure `mobile/services/apiClient.ts` uses production URL
   - Test API connectivity

2. **Test on Physical Devices**:
   - Install Expo Go app
   - Scan QR code from `expo start`
   - Test all features

3. **Environment-Specific Builds**:
   - Use EAS Build Profiles for different environments
   - Create `eas.json`:
   ```json
   {
     "build": {
       "development": {
         "developmentClient": true,
         "distribution": "internal"
       },
       "preview": {
         "distribution": "internal"
       },
       "production": {}
     }
   }
   ```

---

## Troubleshooting

### Backend Issues

**Problem**: Backend won't start on Railway
- **Solution**: Check logs for errors, verify all environment variables are set

**Problem**: Database connection fails
- **Solution**: Verify `DATABASE_URL` uses `${{Postgres.DATABASE_URL}}` reference

**Problem**: Migrations fail
- **Solution**: Check migration files are in `src/database/migrations/`, verify database is accessible

**Problem**: CORS errors
- **Solution**: Update CORS settings in `backend/src/main.ts` to allow your Expo app origin

### Mobile App Issues

**Problem**: Can't connect to backend
- **Solution**: 
  - Verify Railway URL is correct
  - Check backend is running (visit URL in browser)
  - Ensure CORS is configured correctly

**Problem**: Build fails
- **Solution**: 
  - Check `app.json` configuration
  - Verify all dependencies are in `package.json`
  - Check EAS build logs

**Problem**: API calls timeout
- **Solution**: 
  - Increase timeout in `apiClient.ts`
  - Check Railway backend logs for slow queries
  - Verify network connectivity

---

## Quick Reference

### Railway Commands
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# View logs
railway logs

# Run command in container
railway run npm run migration:run
```

### Expo Commands
```bash
# Start development server
expo start

# Build for production
eas build --platform all

# Submit to stores
eas submit --platform ios
eas submit --platform android

# View builds
eas build:list
```

---

## Security Checklist

- [ ] Change default JWT_SECRET to strong random string
- [ ] Never commit `.env` files to GitHub
- [ ] Use Railway's environment variable encryption
- [ ] Enable HTTPS (Railway provides this automatically)
- [ ] Review CORS settings for production
- [ ] Set up database backups
- [ ] Monitor Railway logs for errors
- [ ] Use Expo's secure storage for sensitive data

---

## Next Steps

1. ✅ Deploy backend to Railway
2. ✅ Deploy mobile app to Expo
3. ✅ Test all features in production
4. ✅ Set up monitoring and alerts
5. ✅ Configure custom domains (optional)
6. ✅ Submit to app stores (optional)

---

## Support

- Railway Docs: https://docs.railway.app
- Expo Docs: https://docs.expo.dev
- EAS Build Docs: https://docs.expo.dev/build/introduction/

Good luck with your deployment! 🚀

