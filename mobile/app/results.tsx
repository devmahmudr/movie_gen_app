import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Pressable,
  ActivityIndicator,
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
  userRating?: number;
  averageRating?: number;
  ratingCount?: number;
  overview?: string;
  country?: string;
  imdbRating?: number;
}

interface LoadMoreButton {
  isLoadMoreButton: true;
}

type FlatListItem = Movie | LoadMoreButton;

interface QuizAnswers {
  context: string;
  moods: string[];
  tags: string[];
  similarTo?: string;
  format: string;
}


export default function ResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const flatListRef = useRef<FlatList>(null);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);

  const [movies, setMovies] = useState<Movie[]>(() => {
    try {
      if (params.movies) {
        return JSON.parse(params.movies as string);
      }
    } catch (error) {
      console.error('Error parsing movies:', error);
    }
    return [];
  });

  // Store original quiz answers
  const getInitialQuizAnswers = (): QuizAnswers | null => {
    try {
      if (params.quizAnswers) {
        return JSON.parse(params.quizAnswers as string);
      }
    } catch (error) {
      console.error('Error parsing quiz answers:', error);
    }
    return null;
  };
  
  const quizAnswersRef = useRef<QuizAnswers | null>(getInitialQuizAnswers());


  const handleGenerateMore = async () => {
    if (!quizAnswersRef.current || isGeneratingMore) {
      return;
    }

    setIsGeneratingMore(true);
    try {
      // Create excludeIds array from current movies
      const excludeIds = movies.map(movie => movie.movieId);

      // Get language preference
      const language = useLanguageStore.getState().language;
      const languageCode = language === 'ru' ? 'ru-RU' : 'en-US';
      
      // Create new recommendDto with excludeIds
      const newRecommendDto = {
        ...quizAnswersRef.current,
        excludeIds,
        language: languageCode,
      };

      console.log('Generating more recommendations with excludeIds:', excludeIds);

      // Make API call
      const newRecommendations = await recommendationsAPI.getRecommendations(newRecommendDto);

      if (newRecommendations && Array.isArray(newRecommendations) && newRecommendations.length > 0) {
        // Append new movies to existing list
        setMovies(prevMovies => {
          return [...prevMovies, ...newRecommendations];
        });
        
        // Don't auto-scroll - let user scroll naturally to see new items
        // Auto-scrolling was causing rendering issues and black screens
        // The "Generate More" button stays at the end, so users can see new items when they scroll down
      } else {
        console.error('No new recommendations received');
        alert('Не удалось найти дополнительные фильмы. Попробуйте изменить предпочтения.');
      }
    } catch (error: any) {
      console.error('Error generating more recommendations:', error);
      
      // Show user-friendly error message
      let errorMessage = 'Не удалось найти дополнительные фильмы. Попробуйте изменить предпочтения.';
      if (error.response?.status === 404) {
        errorMessage = 'Не удалось найти дополнительные фильмы с такими предпочтениями. Попробуйте изменить критерии поиска.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Ошибка сервера при поиске фильмов. Попробуйте позже.';
      }
      
      alert(errorMessage);
    } finally {
      setIsGeneratingMore(false);
    }
  };

  const handleToggleWatchlist = useCallback(async (movie: Movie) => {
    try {
      const result = await watchlistAPI.toggle({
        movieId: movie.movieId,
        title: movie.title,
        posterPath: movie.posterPath,
      });
      console.log(`${result.isAdded ? 'Added to' : 'Removed from'} watchlist: ${movie.title}`);
      return result.isAdded;
    } catch (error: any) {
      console.error('Error toggling watchlist:', error);
      throw error; // Re-throw to let MovieCard handle the error
    }
  }, []);

  const handleRemove = useCallback((movie: Movie) => {
    console.log(`Removed from recommendations: ${movie.title}`);
    // Note: This doesn't actually remove from the list since we'd need state management
    // The user can just swipe to the next movie
  }, []);

  const handleRate = useCallback(async (movie: Movie, rating: number) => {
    if (!movie.historyId) {
      console.warn('No historyId for movie:', movie.title);
      return false;
    }
    try {
      const updated = await historyAPI.rateMovie(movie.historyId, rating);
      console.log(`Rated movie: ${movie.title}`, updated.userRating);
      // Update the movie in the movies array
      setMovies(prevMovies => 
        prevMovies.map(m => 
          m.historyId === movie.historyId 
            ? { ...m, userRating: updated.userRating, isWatched: updated.isWatched }
            : m
        )
      );
      return true;
    } catch (error: any) {
      console.error('Error rating movie:', error);
      throw error;
    }
  }, []);

  const handleToggleNotInterested = useCallback(async (movie: Movie) => {
    if (!movie.historyId) {
      console.warn('No historyId for movie:', movie.title);
      return false;
    }
    try {
      const updated = await historyAPI.markAsNotInterested(movie.historyId);
      console.log(`Toggled not interested status: ${movie.title}`, updated.isNotInterested);
      // Update the movie in the movies array
      setMovies(prevMovies => 
        prevMovies.map(m => 
          m.historyId === movie.historyId 
            ? { ...m, isNotInterested: updated.isNotInterested }
            : m
        )
      );
      return updated.isNotInterested;
    } catch (error: any) {
      console.error('Error toggling not interested:', error);
      throw error;
    }
  }, []);

  const handleBack = () => {
    // Navigate back and ensure quiz screen resets its loading state
    router.back();
  };

  // Create data array with Generate More button at the end
  // Use useMemo to prevent recreating on every render
  const flatListData: FlatListItem[] = useMemo(() => {
    return [...movies, { isLoadMoreButton: true }];
  }, [movies]);

  const renderItem = useCallback(({ item, index }: { item: FlatListItem; index: number }) => {
    // Check if this is the Generate More button
    if ('isLoadMoreButton' in item && item.isLoadMoreButton) {
      return (
        <View style={styles.movieContainer}>
          <View style={styles.generateMoreContainer}>
            {isGeneratingMore ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Поиск фильмов...</Text>
              </View>
            ) : (
              <View style={styles.generateMoreContent}>
                <Ionicons name="search" size={64} color={theme.colors.primary} />
                <Text style={styles.generateMoreTitle}>Найти еще 3 фильма</Text>
                <Text style={styles.generateMoreSubtitle}>
                  Получите дополнительные рекомендации на основе ваших предпочтений
                </Text>
                <Pressable
                  style={styles.generateMoreButton}
                  onPress={handleGenerateMore}
                  disabled={isGeneratingMore}
                >
                  <Text style={styles.generateMoreButtonText}>Найти</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      );
    }

    // Render regular movie card
    const movie = item as Movie;
    // Check if this is the last movie (before the Generate More button)
    // The Generate More button is at index movies.length, so last movie is at movies.length - 1
    const isLastMovie = index === movies.length - 1;
    
    return (
      <View style={[styles.movieContainer, { backgroundColor: theme.colors.background }]}>
        <MovieCard
          movie={movie}
          historyId={movie.historyId}
          initialIsWatched={movie.isWatched || false}
          initialIsNotInterested={movie.isNotInterested || false}
          initialIsInWatchlist={false} // Will be determined by toggle result
          onToggleWatchlist={async () => {
            const isAdded = await handleToggleWatchlist(movie);
            return isAdded;
          }}
          onRate={async (rating: number) => {
            const success = await handleRate(movie, rating);
            return success;
          }}
          onToggleNotInterested={() => handleToggleNotInterested(movie)}
          onRemove={() => handleRemove(movie)}
        />
        {!isLastMovie && <View style={styles.divider} />}
      </View>
    );
  }, [movies.length, isGeneratingMore]);

  if (movies.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Нет рекомендаций</Text>
          <Pressable
            style={styles.backButton}
            onPress={handleBack}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
            <Text style={styles.backButtonText}>Назад</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Hide default header and use custom one */}
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
        <Pressable onPress={handleBack} style={styles.backButtonHeader}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Топ-3 для тебя</Text>
          {quizAnswersRef.current?.moods && quizAnswersRef.current.moods.length > 0 && (
            <Text style={styles.moodInfo}>
              Настроение: {quizAnswersRef.current.moods.join(' + ')}
            </Text>
          )}
        </View>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        ref={flatListRef}
        data={flatListData}
        renderItem={renderItem}
        style={{ backgroundColor: theme.colors.background, flex: 1 }}
        contentContainerStyle={{ 
          paddingBottom: 80, 
          backgroundColor: theme.colors.background,
          flexGrow: 1
        }}
        keyExtractor={(item, index) => {
          if ('isLoadMoreButton' in item && item.isLoadMoreButton) {
            return 'load-more-button';
          }
          // Use stable key: historyId if available (unique per movie), otherwise movieId + index
          // This ensures keys don't change when items are added
          const movie = item as Movie;
          if (movie.historyId) {
            return `movie-history-${movie.historyId}`;
          }
          return `movie-${movie.movieId}-${index}`;
        }}
        showsVerticalScrollIndicator={true}
        // Performance optimizations - adjusted to prevent black screen
        removeClippedSubviews={false} // Disabled to prevent black areas when scrolling
        maxToRenderPerBatch={5}
        windowSize={5} // Balanced window size for proper rendering
        initialNumToRender={3}
        updateCellsBatchingPeriod={150}
        // Ensure proper rendering
        disableVirtualization={false}
        // Better scroll handling
        onEndReachedThreshold={0.5}
        // Handle scroll failures
        onScrollToIndexFailed={(info) => {
          console.warn('ScrollToIndex failed, using fallback:', info);
          // Wait for layout
          setTimeout(() => {
            if (flatListRef.current) {
              // Use getItemLayout estimate or scroll to offset
              const estimatedItemHeight = info.averageItemLength || 600;
              flatListRef.current.scrollToOffset({
                offset: Math.max(0, estimatedItemHeight * (info.index - 1)),
                animated: true,
              });
            }
          }, 100);
        }}
      />
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
  backButtonHeader: {
    padding: theme.spacing.sm,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  moodInfo: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginTop: theme.spacing.xs,
  },
  placeholder: {
    width: 40,
  },
  movieContainer: {
    width: '100%',
    backgroundColor: theme.colors.background,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.lg,
    marginHorizontal: theme.spacing.md,
    opacity: 0.9,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  emptyText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    marginBottom: theme.spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.backgroundDark,
    borderRadius: theme.borderRadius.md,
  },
  backButtonText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.md,
  },
  generateMoreContainer: {
    width: '100%',
    minHeight: 400,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  generateMoreContent: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 300,
  },
  generateMoreTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  generateMoreSubtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: 22,
  },
  generateMoreButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    minWidth: 200,
  },
  generateMoreButtonText: {
    color: '#000',
    fontSize: theme.fontSize.md,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.md,
  },
});
