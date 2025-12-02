# Movie Recommendation Mobile App

A React Native mobile application built with Expo for personalized movie recommendations.

## Features

- 🔐 Authentication (Login/Register) with JWT tokens
- 🎬 Personalized movie recommendations based on user preferences
- 📝 Interactive 5-step quiz to gather user preferences
- 📱 Swipeable movie cards with detailed information
- 💾 Watchlist/History tracking
- 👤 User profile management

## Tech Stack

- **React Native** with **Expo** (~50.0.0)
- **Expo Router** for file-based navigation
- **TypeScript** for type safety
- **Zustand** for state management
- **Axios** for API calls
- **Expo Secure Store** for secure token storage

## Project Structure

```
mobile/
├── app/
│   ├── (auth)/          # Authentication screens
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/          # Main app tabs
│   │   ├── _layout.tsx
│   │   ├── home.tsx
│   │   ├── watchlist.tsx
│   │   └── profile.tsx
│   ├── quiz.tsx         # Quiz screen
│   ├── results.tsx      # Results screen
│   └── _layout.tsx      # Root layout with auth guard
├── components/          # Reusable components
│   ├── StyledButton.tsx
│   ├── StyledInput.tsx
│   └── MovieCard.tsx
├── constants/
│   └── theme.ts         # Theme configuration
├── services/
│   └── apiClient.ts     # Axios client with interceptors
├── store/
│   └── authStore.ts     # Zustand auth store
└── package.json
```

## Setup Instructions

1. **Install dependencies:**
   ```bash
   cd mobile
   npm install
   ```

2. **Configure API endpoint:**
   - Open `services/apiClient.ts`
   - Update `API_BASE_URL` to match your backend server
   - Default: `http://localhost:3000` (development)

3. **Start the development server:**
   ```bash
   npm start
   ```

4. **Run on your device:**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app on your physical device

## API Integration

The app connects to the backend API with the following endpoints:

- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `GET /users/me` - Get user profile
- `POST /recommend` - Get movie recommendations
- `GET /history` - Get viewing history

All protected endpoints automatically include the JWT token via Axios interceptors.

## Authentication Flow

1. User logs in or registers
2. JWT token is stored securely using `expo-secure-store`
3. Root layout (`app/_layout.tsx`) checks authentication status
4. Authenticated users see tabs, unauthenticated users are redirected to login

## Quiz Flow

The quiz consists of 5 steps:
1. **Context**: Who are you watching with?
2. **Moods**: What mood are you in? (select up to 2)
3. **Tags**: What genres/tags do you prefer? (select up to 2)
4. **Similar To**: Similar movie preference (optional)
5. **Format**: Movie, Series, or Both

After completion, recommendations are fetched and displayed on the results screen.

## Theme

The app uses a dark theme with neon accents:
- Background: `#000000`
- Primary: `#00F5FF` (Neon Teal)
- Secondary: `#FF00FF` (Neon Magenta)
- Text: `#FFFFFF`

## Development Notes

- The app uses Expo Router's file-based routing
- Authentication state is managed globally with Zustand
- All API calls include automatic JWT token injection
- Secure token storage ensures tokens persist across app restarts

## Troubleshooting

**API Connection Issues:**
- Ensure backend server is running
- Check `API_BASE_URL` in `services/apiClient.ts`
- For physical devices, use your computer's IP address instead of `localhost`

**Build Issues:**
- Clear cache: `expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`

## Next Steps

- Add proper icon library (e.g., `@expo/vector-icons`)
- Implement trailer playback functionality
- Add watchlist add/remove functionality
- Enhance movie card with more details
- Add error boundaries and better error handling

