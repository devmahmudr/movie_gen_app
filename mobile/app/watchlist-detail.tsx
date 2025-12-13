import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Pressable,
  Animated,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MovieCard } from '../components/MovieCard';
import { theme } from '../constants/theme';
import { watchlistAPI, historyAPI, recommendationsAPI } from '../services/apiClient';
import { useLanguageStore } from '../store/languageStore';

interface Movie {
  movieId: string;
  title: string;
  posterPath: string;
  reason?: string;
  trailerKey?: string;
  genres?: string[];
  releaseYear?: string;
  historyId?: string;
  isWatched?: boolean;
  isNotInterested?: boolean;
  userRating?: number | null;
  publicRating?: number;
}

export default function WatchlistDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isInWatchlist, setIsInWatchlist] = useState(true); // Default to true since we're coming from watchlist
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadMovieDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMovieDetails = async () => {
    try {
      setLoading(true);
      const movieId = params.movieId as string;
      if (!movieId) {
        setError('Movie ID not provided');
        return;
      }

      // Get language preference
      const language = useLanguageStore.getState().language;
      const languageCode = language === 'ru' ? 'ru-RU' : 'en-US';
      
      const movieData = await recommendationsAPI.getMovieDetails(movieId, languageCode);
      setMovie(movieData);
      
      // Verify movie is in watchlist (it should be since we came from watchlist)
      try {
        const watchlist = await watchlistAPI.getWatchlist();
        const isInList = watchlist.some((item: any) => item.movieId === movieId);
        setIsInWatchlist(isInList);
      } catch (err) {
        // If check fails, assume it's in watchlist (we came from watchlist page)
        console.log('Could not verify watchlist status, assuming true');
      }
      
      // Fade in animation - smooth and natural
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } catch (err: any) {
      setError('Не удалось загрузить информацию о фильме');
      console.error('Error loading movie details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleHome = () => {
    router.replace('/(tabs)/home');
  };

  const handleToggleWatchlist = async (movie: Movie) => {
    try {
      const result = await watchlistAPI.toggle({
        movieId: movie.movieId,
        title: movie.title,
        posterPath: movie.posterPath,
      });
      console.log(`${result.isAdded ? 'Added to' : 'Removed from'} watchlist: ${movie.title}`);
      setIsInWatchlist(result.isAdded);
      
      // Navigate back to watchlist after removal
      if (!result.isAdded) {
      router.back();
      }
      
      return result.isAdded;
    } catch (error: any) {
      console.error('Error toggling watchlist:', error);
      throw error;
    }
  };

  const handleToggleWatched = async (movie: Movie) => {
    if (!movie.historyId) {
      console.warn('No historyId for movie:', movie.title);
      return false;
    }
    try {
      const updated = await historyAPI.markAsWatched(movie.historyId);
      console.log(`Toggled watched status: ${movie.title}`, updated.isWatched);
      setMovie(prev => prev ? { ...prev, isWatched: updated.isWatched } : null);
      return updated.isWatched;
    } catch (error: any) {
      console.error('Error toggling watched:', error);
      throw error;
    }
  };

  const handleToggleNotInterested = async (movie: Movie) => {
    if (!movie.historyId) {
      console.warn('No historyId for movie:', movie.title);
      return false;
    }
    try {
      const updated = await historyAPI.markAsNotInterested(movie.historyId);
      console.log(`Toggled not interested status: ${movie.title}`, updated.isNotInterested);
      setMovie(prev => prev ? { ...prev, isNotInterested: updated.isNotInterested } : null);
      return updated.isNotInterested;
    } catch (error: any) {
      console.error('Error toggling not interested:', error);
      throw error;
    }
  };

  const handleRate = async (movie: Movie, rating: number) => {
    if (!movie.historyId) {
      console.warn('No historyId for movie:', movie.title);
      return;
    }
    try {
      const updated = await historyAPI.setRating(movie.historyId, rating);
      console.log(`Rated movie: ${movie.title}`, updated.userRating);
      setMovie(prev => prev ? { ...prev, userRating: updated.userRating, isWatched: true } : null);
    } catch (error: any) {
      console.error('Error rating movie:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !movie) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <Pressable onPress={handleHome} style={styles.homeButtonHeader}>
            <Ionicons name="home" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.title}>Детали фильма</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Фильм не найден'}</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Назад</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.homeButtonHeader}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>Избранное</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <Animated.View style={[styles.movieContainer, { opacity: fadeAnim }]}>
          <MovieCard
            movie={movie}
            historyId={movie.historyId}
            initialIsWatched={movie.isWatched || false}
            initialIsNotInterested={movie.isNotInterested || false}
            initialIsInWatchlist={isInWatchlist}
            initialUserRating={movie.userRating || null}
            onToggleWatchlist={async () => {
              const isAdded = await handleToggleWatchlist(movie);
              return isAdded;
            }}
            onToggleWatched={() => handleToggleWatched(movie)}
            onToggleNotInterested={() => handleToggleNotInterested(movie)}
            onRate={async (rating: number) => await handleRate(movie, rating)}
          />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  homeButtonHeader: {
    padding: theme.spacing.sm,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80, // Add padding for navbar
  },
  movieContainer: {
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.fontSize.md,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  backButton: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.backgroundDark,
    borderRadius: theme.borderRadius.md,
  },
  backButtonText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
});

