import axios from 'axios';
import { Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';

// Determine API base URL based on environment
// Priority:
// 1. EXPO_PUBLIC_API_URL environment variable (set in eas.json or .env)
// 2. Development: Detect emulator vs physical device
// 3. Production: Use Railway URL from eas.json
const getApiBaseUrl = (): string => {
  // ALWAYS check environment variable first (highest priority)
  // This is set in eas.json for builds, or .env for Expo Go
  if (process.env.EXPO_PUBLIC_API_URL) {
    const url = process.env.EXPO_PUBLIC_API_URL.trim();
    // Ensure URL has protocol
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  }

  // Development mode - auto-detect emulator vs physical device
  if (__DEV__) {
    // Check if running in Expo Go (development client)
    // For Expo Go, we need the local IP address
    // For emulators, use special addresses
    
    if (Platform.OS === 'android') {
      // Android emulator uses 10.0.2.2 to access host machine's localhost
      // If this doesn't work, user should set EXPO_PUBLIC_API_URL in .env
      return 'http://10.0.2.2:3000';
    } else {
      // iOS Simulator can use localhost directly
      // For physical iOS device, user must set EXPO_PUBLIC_API_URL
      return 'http://localhost:3000';
    }
  }

  // Production mode - should always have EXPO_PUBLIC_API_URL set
  // If not set, this is a configuration error
  console.error('❌ CRITICAL: EXPO_PUBLIC_API_URL not set in production build!');
  console.error('❌ Please set EXPO_PUBLIC_API_URL in eas.json production profile');
  return 'https://moviegenapp-production.up.railway.app'; // Fallback (should not happen)
};

// Get API base URL and ensure it has protocol
let API_BASE_URL = getApiBaseUrl();
// Ensure URL has https:// protocol (fix for Railway URLs without protocol)
if (API_BASE_URL && !API_BASE_URL.startsWith('http://') && !API_BASE_URL.startsWith('https://')) {
  API_BASE_URL = `https://${API_BASE_URL}`;
}

// Remove trailing slash if present
if (API_BASE_URL.endsWith('/')) {
  API_BASE_URL = API_BASE_URL.slice(0, -1);
}

// Always log API URL for debugging (helps diagnose production issues)
// This runs when the module loads, so it will show in logs immediately
const resolvedFrom = process.env.EXPO_PUBLIC_API_URL 
  ? 'EXPO_PUBLIC_API_URL env var' 
  : (__DEV__ 
    ? (Platform.OS === 'android' 
      ? 'Android emulator default (10.0.2.2:3000)' 
      : 'iOS simulator default (localhost:3000) - For physical device, set EXPO_PUBLIC_API_URL in .env')
    : 'Production fallback - EXPO_PUBLIC_API_URL should be set in eas.json!');

console.log('🔗 API Configuration:', {
  baseURL: API_BASE_URL,
  envVar: process.env.EXPO_PUBLIC_API_URL || 'NOT SET',
  isDev: __DEV__,
  platform: Platform.OS,
  resolvedFrom,
});

// Warn if configuration might be wrong
if (!__DEV__ && !process.env.EXPO_PUBLIC_API_URL) {
  console.error('⚠️ WARNING: EXPO_PUBLIC_API_URL is not set in production build!');
  console.error('⚠️ The app will try to connect to:', API_BASE_URL);
  console.error('⚠️ Make sure to set EXPO_PUBLIC_API_URL in eas.json production profile!');
}

if (__DEV__ && !process.env.EXPO_PUBLIC_API_URL && Platform.OS === 'ios') {
  console.warn('💡 TIP: For physical iOS device, create .env file with:');
  console.warn('💡 EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:3000');
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Request interceptor to add JWT token and log requests
apiClient.interceptors.request.use(
  async (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log every request (especially important for production debugging)
    const fullUrl = `${config.baseURL || API_BASE_URL}${config.url || ''}`;
    console.log('📤 API Request:', {
      method: config.method?.toUpperCase(),
      url: fullUrl,
      baseURL: config.baseURL || API_BASE_URL,
      endpoint: config.url,
      hasToken: !!token,
    });
    
    return config;
  },
  (error) => {
    console.error('❌ Request Interceptor Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Check for network/connection errors
    const isNetworkError = 
      !error.response && 
      (error.code === 'ECONNREFUSED' || 
       error.code === 'ENOTFOUND' || 
       error.code === 'ETIMEDOUT' ||
       error.code === 'ECONNABORTED' ||
       error.message?.includes('Network Error') ||
       error.message?.includes('network request failed') ||
       error.message?.includes('timeout'));

    // Always log connection errors (even in production) for debugging
    if (isNetworkError) {
      const attemptedUrl = error.config?.url 
        ? `${error.config.baseURL || API_BASE_URL}${error.config.url}` 
        : 'N/A';
      
      console.error('❌ API Connection Error:', {
        message: 'Cannot connect to backend server',
        attemptedURL: attemptedUrl,
        baseURL: API_BASE_URL,
        endpoint: error.config?.url || 'N/A',
        error: error.message,
        code: error.code,
        platform: Platform.OS,
        isDev: __DEV__,
        hasEnvVar: !!process.env.EXPO_PUBLIC_API_URL,
        envVarValue: process.env.EXPO_PUBLIC_API_URL || 'NOT SET - Check eas.json!',
        timestamp: new Date().toISOString(),
      });
      
      // Additional helpful message
      if (!process.env.EXPO_PUBLIC_API_URL && !__DEV__) {
        console.error('💡 SOLUTION: Rebuild the app with EXPO_PUBLIC_API_URL set in eas.json');
      }
    } else if (__DEV__) {
      // Log other errors only in development
      console.error('API Error:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
        url: error.config?.url,
        baseURL: API_BASE_URL,
      });
    }

    if (error.response?.status === 401) {
      // Token expired or invalid, logout user
      await useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

// API methods
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await apiClient.post('/auth/login', { email, password });
    return response.data;
  },
  register: async (email: string, password: string) => {
    const response = await apiClient.post('/auth/register', { email, password });
    return response.data;
  },
};

export const userAPI = {
  getProfile: async () => {
    const response = await apiClient.get('/users/me');
    return response.data;
  },
};

export const recommendationsAPI = {
  getRecommendations: async (data: {
    context: string;
    moods: string[];
    tags: string[];
    similarTo?: string;
    format: string;
    excludeIds?: string[];
    language?: string;
  }) => {
    // Use a longer timeout for recommendations since it involves OpenAI + TMDb calls
    // Increased to 90 seconds to handle multiple retry attempts and parallel API calls
    const response = await apiClient.post('/recommend', data, {
      timeout: 90000, // 90 seconds - recommendations can take time, especially with retries
    });
    return response.data;
  },
  getMovieDetails: async (movieId: string, language?: string) => {
    const params = language ? { language } : {};
    const response = await apiClient.get(`/recommend/movie/${movieId}`, { params });
    return response.data;
  },
};

export const historyAPI = {
  getHistory: async (page: number = 1, limit: number = 20) => {
    const response = await apiClient.get(`/history?page=${page}&limit=${limit}`);
    return response.data;
  },
  markAsWatched: async (historyId: string) => {
    const response = await apiClient.patch(`/history/${historyId}/watched`);
    return response.data;
  },
  markAsNotInterested: async (historyId: string) => {
    const response = await apiClient.patch(`/history/${historyId}/not-interested`);
    return response.data;
  },
  rateMovie: async (historyId: string, rating: number) => {
    const response = await apiClient.patch(`/history/${historyId}/rating`, { rating });
    return response.data;
  },
  getAverageRating: async (movieId: string) => {
    const response = await apiClient.get(`/history/movie/${movieId}/rating`);
    return response.data;
  },
  getMovieRatings: async (movieId: string) => {
    const response = await apiClient.get(`/history/movie/${movieId}/ratings`);
    return response.data;
  },
};

export const watchlistAPI = {
  getWatchlist: async () => {
    const response = await apiClient.get('/watchlist');
    return response.data;
  },
  addToWatchlist: async (data: {
    movieId: string;
    title: string;
    posterPath?: string;
  }) => {
    const response = await apiClient.post('/watchlist', data);
    return response.data;
  },
  removeFromWatchlist: async (watchlistId: string) => {
    const response = await apiClient.delete(`/watchlist/${watchlistId}`);
    return response.data;
  },
  removeByMovieId: async (movieId: string) => {
    const response = await apiClient.delete(`/watchlist/movie/${movieId}`);
    return response.data;
  },
  toggle: async (data: {
    movieId: string;
    title: string;
    posterPath?: string;
  }) => {
    const response = await apiClient.post('/watchlist/toggle', data);
    return response.data;
  },
};

