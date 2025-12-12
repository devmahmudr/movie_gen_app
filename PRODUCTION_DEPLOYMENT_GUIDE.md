# 🚀 Production Deployment Guide
## Expo Cloud + Railway

This guide walks you through deploying your Movie App to production:
- **Backend**: Railway (NestJS API)
- **Mobile App**: Expo Cloud (React Native/Expo)
- **Database**: Railway PostgreSQL

---

## 📋 Prerequisites

Before starting, ensure you have:

- [ ] Railway account ([railway.app](https://railway.app))
- [ ] Expo account ([expo.dev](https://expo.dev))
- [ ] EAS CLI installed: `npm install -g eas-cli`
- [ ] Railway CLI installed: `npm install -g @railway/cli` (optional)
- [ ] Git repository set up
- [ ] All API keys ready:
  - TMDB API Key
  - OpenAI API Key
  - JWT Secret (generate a strong secret)

---

## 🗄️ Part 1: Database Setup on Railway

### Step 1: Create PostgreSQL Database

1. **Login to Railway**: Go to [railway.app](https://railway.app) and sign in
2. **Create New Project**: Click "New Project"
3. **Add PostgreSQL Service**:
   - Click "+ New" → "Database" → "Add PostgreSQL"
   - Railway will automatically provision a PostgreSQL database
4. **Get Database URL**:
   - Click on the PostgreSQL service
   - Go to the "Variables" tab
   - Copy the `DATABASE_URL` value (you'll need this later)

**Note**: Railway automatically creates a `DATABASE_URL` environment variable. Keep this secure!

---

## 🖥️ Part 2: Backend Deployment on Railway

### Step 1: Prepare Your Backend

1. **Verify `railway.json` exists** in the root directory:
   ```json
   {
     "$schema": "https://railway.app/railway.schema.json",
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 10
     }
   }
   ```

2. **Check `package.json`** has the correct start script:
   ```json
   {
     "scripts": {
       "start": "npm run start:prod",
       "start:prod": "node dist/src/main",
       "build": "nest build",
       "postbuild": "npm run migration:run"
     }
   }
   ```

### Step 2: Deploy Backend to Railway

#### Option A: Deploy via GitHub (Recommended)

1. **Connect GitHub Repository**:
   - In Railway dashboard, click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Select the branch (usually `main` or `master`)

2. **Configure Service**:
   - Railway will detect your `backend/` directory
   - If not, set the **Root Directory** to `backend`
   - Set the **Build Command** to: `npm install && npm run build`
   - Set the **Start Command** to: `npm start`

3. **Set Environment Variables**:
   - Go to your service → "Variables" tab
   - Add the following variables:

   ```bash
   NODE_ENV=production
   PORT=3000
   
   # Database (from PostgreSQL service)
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   # OR manually: postgresql://user:password@host:port/database
   
   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-min-32-chars-change-this
   JWT_EXPIRATION_TIME=24h
   
   # API Keys
   TMDB_API_KEY=your_tmdb_api_key
   OPENAI_API_KEY=your_openai_api_key
   
   # Optional APIs
   YOUTUBE_API_KEY=your_youtube_api_key
   OMDB_API_KEY=your_omdb_api_key
   ```

   **Important**: 
   - Use Railway's variable reference `${{Postgres.DATABASE_URL}}` to link to your database
   - Generate a strong JWT_SECRET (at least 32 characters)
   - Never commit API keys to Git

4. **Deploy**:
   - Railway will automatically build and deploy
   - Check the "Deployments" tab for build logs
   - Wait for deployment to complete

5. **Get Your Backend URL**:
   - Go to your service → "Settings" → "Networking"
   - Click "Generate Domain" to get a public URL
   - Example: `https://your-app-name.up.railway.app`
   - **Save this URL** - you'll need it for the mobile app

#### Option B: Deploy via Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
cd backend
railway init

# Link to existing project (or create new)
railway link

# Set environment variables
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set DATABASE_URL=${{Postgres.DATABASE_URL}}
railway variables set JWT_SECRET=your-secret-key
railway variables set TMDB_API_KEY=your-key
railway variables set OPENAI_API_KEY=your-key

# Deploy
railway up
```

### Step 3: Verify Backend Deployment

1. **Check Health Endpoint**:
   ```bash
   curl https://your-app-name.up.railway.app/recommend/health
   ```
   Should return: `{"status":"ok","info":{"database":{"status":"up"}}}`

2. **Check Railway Logs**:
   - Go to your service → "Deployments" → Click latest deployment → "View Logs"
   - Look for: `Application is running on: http://0.0.0.0:3000`

3. **Test API Endpoints**:
   ```bash
   # Test registration
   curl -X POST https://your-app-name.up.railway.app/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test123","username":"testuser"}'
   ```

### Step 4: Database Migrations

Railway will automatically run migrations via the `postbuild` script. Verify:

1. Check deployment logs for: `migration:run`
2. If migrations fail, you can run them manually:
   ```bash
   railway run npm run migration:run
   ```

---

## 📱 Part 3: Mobile App Deployment to Expo Cloud

### Step 1: Install EAS CLI and Login

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo
eas login

# Configure EAS (if first time)
eas build:configure
```

### Step 2: Update Configuration Files

1. **Update `mobile/eas.json`**:
   ```json
   {
     "cli": {
       "version": ">= 5.2.0"
     },
     "build": {
       "development": {
         "developmentClient": true,
         "distribution": "internal",
         "env": {
           "EXPO_PUBLIC_API_URL": "http://YOUR_LOCAL_IP:3000"
         }
       },
       "preview": {
         "distribution": "internal",
         "env": {
           "EXPO_PUBLIC_API_URL": "https://your-app-name.up.railway.app"
         }
       },
       "production": {
         "env": {
           "EXPO_PUBLIC_API_URL": "https://your-app-name.up.railway.app"
         }
       }
     },
     "submit": {
       "production": {}
     }
   }
   ```

   **Replace** `https://your-app-name.up.railway.app` with your actual Railway backend URL!

2. **Update `mobile/app.json`** (if needed):
   ```json
   {
     "expo": {
       "name": "Movie App",
       "slug": "movie-app",
       "version": "1.0.0",
       "ios": {
         "bundleIdentifier": "com.yourcompany.movieapp"
       },
       "android": {
         "package": "com.yourcompany.movieapp"
       },
       "extra": {
         "eas": {
           "projectId": "your-project-id"
         }
       }
     }
   }
   ```

### Step 3: Build Production App

#### For iOS:

```bash
cd mobile

# Build for iOS App Store
eas build --platform ios --profile production

# Or build for TestFlight (internal testing)
eas build --platform ios --profile preview
```

**Requirements for iOS**:
- Apple Developer Account ($99/year)
- Configure app signing in Expo dashboard
- Or use EAS Build's managed credentials

#### For Android:

```bash
cd mobile

# Build for Google Play Store
eas build --platform android --profile production

# Or build APK for direct distribution
eas build --platform android --profile preview
```

**Requirements for Android**:
- Google Play Developer Account ($25 one-time)
- Or build APK for direct installation

### Step 4: Monitor Build Progress

1. **Check Build Status**:
   ```bash
   eas build:list
   ```

2. **View Build Logs**:
   - Go to [expo.dev](https://expo.dev)
   - Navigate to your project → "Builds"
   - Click on a build to see logs

3. **Download Build**:
   - Once complete, download from Expo dashboard
   - Or use: `eas build:download`

### Step 5: Submit to App Stores (Optional)

#### Submit to Apple App Store:

```bash
# Configure app store credentials first
eas submit --platform ios --profile production
```

#### Submit to Google Play Store:

```bash
# Configure Google Play credentials first
eas submit --platform android --profile production
```

---

## 🔄 Part 4: Over-The-Air (OTA) Updates

Expo supports OTA updates for JavaScript changes without rebuilding:

### Step 1: Configure Updates

Your `app.json` should have:
```json
{
  "expo": {
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "updates": {
      "url": "https://u.expo.dev/your-project-id"
    }
  }
}
```

### Step 2: Publish Updates

```bash
cd mobile

# Publish update
eas update --branch production --message "Bug fixes and improvements"

# Or for preview
eas update --branch preview --message "Preview update"
```

**Note**: OTA updates only work for JavaScript changes. Native changes require a new build.

---

## ✅ Part 5: Verification Checklist

### Backend Verification:

- [ ] Backend is accessible at Railway URL
- [ ] Health endpoint returns `{"status":"ok"}`
- [ ] Database migrations ran successfully
- [ ] Environment variables are set correctly
- [ ] API endpoints respond correctly
- [ ] CORS is configured (allows all origins)
- [ ] Logs show no errors

### Mobile App Verification:

- [ ] `eas.json` has correct production API URL
- [ ] Build completed successfully
- [ ] App connects to Railway backend
- [ ] Authentication works
- [ ] API calls succeed
- [ ] No console errors

### Integration Testing:

1. **Test Registration**:
   - Open app
   - Register new user
   - Verify account created

2. **Test Login**:
   - Login with credentials
   - Verify JWT token received

3. **Test API Calls**:
   - Search for movies
   - Get recommendations
   - Add to watchlist
   - View history

---

## 🔧 Part 6: Environment Variables Reference

### Backend (Railway) Variables:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | Yes | Environment | `production` |
| `PORT` | Yes | Server port | `3000` |
| `DATABASE_URL` | Yes | PostgreSQL connection | `postgresql://...` |
| `JWT_SECRET` | Yes | JWT signing secret | `your-secret-key` |
| `JWT_EXPIRATION_TIME` | No | Token expiration | `24h` |
| `TMDB_API_KEY` | Yes | TMDB API key | `abc123...` |
| `OPENAI_API_KEY` | Yes | OpenAI API key | `sk-...` |
| `YOUTUBE_API_KEY` | No | YouTube API key | `AIza...` |
| `OMDB_API_KEY` | No | OMDB API key | `123456` |

### Mobile App (EAS Build) Variables:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `EXPO_PUBLIC_API_URL` | Yes | Backend API URL | `https://app.up.railway.app` |

---

## 🐛 Troubleshooting

### Backend Issues

#### Issue: Build fails on Railway

**Solutions**:
1. Check build logs in Railway dashboard
2. Verify `package.json` has correct scripts
3. Ensure Node.js version matches (check `engines` in `package.json`)
4. Check for TypeScript errors: `cd backend && npm run build`

#### Issue: Database connection fails

**Solutions**:
1. Verify `DATABASE_URL` is set correctly
2. Use Railway's variable reference: `${{Postgres.DATABASE_URL}}`
3. Check database service is running
4. Verify network connectivity

#### Issue: Migrations fail

**Solutions**:
1. Check migration files exist in `backend/src/database/migrations/`
2. Run migrations manually: `railway run npm run migration:run`
3. Check database permissions
4. Review migration logs

#### Issue: API returns CORS errors

**Solutions**:
1. Verify CORS is enabled in `main.ts`
2. Check `origin: true` allows all origins
3. Verify mobile app uses correct API URL

### Mobile App Issues

#### Issue: Build fails

**Solutions**:
1. Check build logs: `eas build:list`
2. Verify `eas.json` syntax is correct
3. Check `app.json` configuration
4. Ensure all dependencies are in `package.json`

#### Issue: App can't connect to backend

**Solutions**:
1. Verify `EXPO_PUBLIC_API_URL` in `eas.json` production profile
2. Check Railway backend is running
3. Test backend URL manually: `curl https://your-url/recommend/health`
4. Rebuild app after changing `eas.json`

#### Issue: Environment variables not working

**Solutions**:
1. Rebuild app after changing `eas.json`
2. Variables must start with `EXPO_PUBLIC_` to be accessible
3. Check variable names match exactly
4. Clear app cache and reinstall

### General Issues

#### Issue: Railway service sleeping

**Solutions**:
1. Upgrade to Railway Pro plan ($20/month) for always-on
2. Or use Railway Hobby plan with sleep (free tier)
3. First request after sleep may be slow

#### Issue: Build takes too long

**Solutions**:
1. Use EAS Build priority (paid feature)
2. Check for large dependencies
3. Optimize build configuration
4. Use build cache

---

## 📊 Part 7: Monitoring & Maintenance

### Railway Monitoring

1. **View Logs**:
   - Railway dashboard → Service → "Deployments" → "View Logs"
   - Or use: `railway logs`

2. **Monitor Metrics**:
   - Railway dashboard → Service → "Metrics"
   - Monitor CPU, Memory, Network

3. **Set Up Alerts**:
   - Railway dashboard → Service → "Settings" → "Notifications"
   - Configure email/Slack alerts

### Expo Monitoring

1. **View Builds**:
   - [expo.dev](https://expo.dev) → Your Project → "Builds"

2. **View Updates**:
   - [expo.dev](https://expo.dev) → Your Project → "Updates"

3. **Analytics** (Optional):
   - Enable Expo Analytics in `app.json`
   - View in Expo dashboard

### Database Maintenance

1. **Backup Database**:
   - Railway provides automatic backups
   - Or use: `railway run pg_dump`

2. **Monitor Database**:
   - Railway dashboard → PostgreSQL service → "Metrics"

---

## 🔐 Part 8: Security Best Practices

### Backend Security

1. **Environment Variables**:
   - ✅ Never commit `.env` files
   - ✅ Use Railway's secure variable storage
   - ✅ Rotate secrets regularly

2. **JWT Secret**:
   - ✅ Use strong, random secret (32+ characters)
   - ✅ Generate: `openssl rand -base64 32`

3. **API Keys**:
   - ✅ Store in Railway variables
   - ✅ Never expose in logs
   - ✅ Rotate if compromised

4. **Database**:
   - ✅ Use Railway's managed PostgreSQL
   - ✅ Enable SSL connections
   - ✅ Restrict access

### Mobile App Security

1. **API Keys**:
   - ✅ Only use `EXPO_PUBLIC_*` for public variables
   - ✅ Never store secrets in app code
   - ✅ Use secure storage for tokens

2. **HTTPS Only**:
   - ✅ Always use HTTPS in production
   - ✅ Never use HTTP for API calls

---

## 📝 Part 9: Quick Reference Commands

### Railway Commands

```bash
# Login
railway login

# Link project
railway link

# View logs
railway logs

# Run command
railway run npm run migration:run

# Set variable
railway variables set KEY=value

# Deploy
railway up
```

### EAS Commands

```bash
# Login
eas login

# Configure
eas build:configure

# Build
eas build --platform ios --profile production
eas build --platform android --profile production

# List builds
eas build:list

# Download build
eas build:download

# Submit to stores
eas submit --platform ios
eas submit --platform android

# Publish update
eas update --branch production
```

---

## 🎯 Part 10: Deployment Workflow

### Initial Deployment

1. ✅ Set up Railway PostgreSQL
2. ✅ Deploy backend to Railway
3. ✅ Configure environment variables
4. ✅ Verify backend is working
5. ✅ Update `eas.json` with Railway URL
6. ✅ Build mobile app with EAS
7. ✅ Test app with production backend
8. ✅ Submit to app stores (optional)

### Updating Backend

1. Make code changes
2. Commit and push to GitHub
3. Railway auto-deploys (if connected)
4. Or manually: `railway up`
5. Verify deployment in logs

### Updating Mobile App

**For JavaScript changes** (OTA Update):
```bash
cd mobile
eas update --branch production
```

**For native changes** (New Build):
```bash
cd mobile
eas build --platform ios --profile production
eas build --platform android --profile production
```

---

## 📚 Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [Expo EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Expo EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [Expo Updates Documentation](https://docs.expo.dev/guides/config-plugins/)

---

## ✅ Final Checklist

Before going live:

- [ ] Backend deployed and accessible
- [ ] Database migrations completed
- [ ] All environment variables set
- [ ] Backend health check passes
- [ ] Mobile app built successfully
- [ ] Mobile app connects to backend
- [ ] Authentication works
- [ ] All features tested
- [ ] Error handling verified
- [ ] Monitoring set up
- [ ] Security measures in place
- [ ] Documentation updated

---

## 🆘 Need Help?

If you encounter issues:

1. Check Railway logs
2. Check Expo build logs
3. Review this guide's troubleshooting section
4. Check Railway/Expo documentation
5. Review error messages carefully

**Good luck with your deployment! 🚀**

