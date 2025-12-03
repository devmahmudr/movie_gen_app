import axios from 'axios';
import { Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';

// Determine API base URL based on environment
// For iOS Simulator: use localhost
// For Android Emulator: use 10.0.2.2 (Android emulator's alias for host machine)
// For physical devices: use your computer's IP address (set via environment variable or default)
// For Docker: backend is accessible at localhost:3000 from host machine
const getApiBaseUrl = (): string => {
  // Check for environment variable first (useful for physical devices)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (__DEV__) {
    // Development mode
    if (Platform.OS === 'android') {
      // Android emulator uses 10.0.2.2 to access host machine's localhost
      return 'http://10.0.2.2:3000';
    } else {
      // iOS Simulator can use localhost directly
      return 'http://localhost:3000';
    }
  } else {
    // Production mode - use environment variable or default
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://your-app.up.railway.app';
    // Ensure URL has https:// protocol
    if (apiUrl && !apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      return `https://${apiUrl}`;
    }
    return apiUrl;
  }
};

// Get API base URL and ensure it has protocol
let API_BASE_URL = getApiBaseUrl();
// Ensure URL has https:// protocol (fix for Railway URLs without protocol)
if (API_BASE_URL && !API_BASE_URL.startsWith('http://') && !API_BASE_URL.startsWith('https://')) {
  API_BASE_URL = `https://${API_BASE_URL}`;
}
console.log('API_BASE_URL', API_BASE_URL);


// Log API URL in development for debugging
if (__DEV__) {
  console.log('API Base URL:', API_BASE_URL);
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Request interceptor to add JWT token
apiClient.interceptors.request.use(
  async (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Log error details in development
    if (__DEV__) {
      // Check for network/connection errors
      const isNetworkError = 
        !error.response && 
        (error.code === 'ECONNREFUSED' || 
         error.code === 'ENOTFOUND' || 
         error.code === 'ETIMEDOUT' ||
         error.message?.includes('Network Error') ||
         error.message?.includes('network request failed'));

      if (isNetworkError) {
        console.error('API Connection Error:', {
          message: 'Cannot connect to backend server',
          url: API_BASE_URL,
          error: error.message,
          code: error.code,
          hint: Platform.OS === 'android' 
            ? 'For Android emulator, using 10.0.2.2. For physical device, set EXPO_PUBLIC_API_URL to your computer IP (e.g., http://192.168.100.115:3000)'
            : 'For iOS simulator, using localhost. For physical device, set EXPO_PUBLIC_API_URL to your computer IP (e.g., http://192.168.100.115:3000)',
        });
      } else {
        console.error('API Error:', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          url: error.config?.url,
        });
      }
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
  }) => {
    // Use a longer timeout for recommendations since it involves OpenAI + TMDb calls
    const response = await apiClient.post('/recommend', data, {
      timeout: 60000, // 60 seconds - recommendations can take time
    });
    return response.data;
  },
  getMovieDetails: async (movieId: string) => {
    const response = await apiClient.get(`/recommend/movie/${movieId}`);
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
};

