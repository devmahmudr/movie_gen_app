import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Dimensions,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MovieCard } from '../components/MovieCard';
import { theme } from '../constants/theme';
import { watchlistAPI, historyAPI, recommendationsAPI } from '../services/apiClient';

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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [currentIndex, setCurrentIndex] = useState(0);
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

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
      setCurrentIndex(newIndex);
    }
  };

  const goToNext = () => {
    // Allow scrolling to the Generate More button
    const maxIndex = movies.length; // movies.length is the Generate More button
    if (currentIndex < maxIndex) {
      const newIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
      setCurrentIndex(newIndex);
    }
  };

  const handleGenerateMore = async () => {
    if (!quizAnswersRef.current || isGeneratingMore) {
      return;
    }

    setIsGeneratingMore(true);
    try {
      // Create excludeIds array from current movies
      const excludeIds = movies.map(movie => movie.movieId);

      // Create new recommendDto with excludeIds
      const newRecommendDto = {
        ...quizAnswersRef.current,
        excludeIds,
      };

      console.log('Generating more recommendations with excludeIds:', excludeIds);

      // Make API call
      const newRecommendations = await recommendationsAPI.getRecommendations(newRecommendDto);

      if (newRecommendations && Array.isArray(newRecommendations) && newRecommendations.length > 0) {
        // Append new movies to existing list
        setMovies(prevMovies => [...prevMovies, ...newRecommendations]);
        
        // Scroll to the first new movie
        setTimeout(() => {
          const newIndex = movies.length;
          flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
          setCurrentIndex(newIndex);
        }, 100);
      } else {
        console.error('No new recommendations received');
      }
    } catch (error: any) {
      console.error('Error generating more recommendations:', error);
      // You could show an error message to the user here
    } finally {
      setIsGeneratingMore(false);
    }
  };

  const handleAddToWatchlist = async (movie: Movie) => {
    try {
      await watchlistAPI.addToWatchlist({
        movieId: movie.movieId,
        title: movie.title,
        posterPath: movie.posterPath,
      });
      console.log(`Added to watchlist: ${movie.title}`);
    } catch (error: any) {
      console.error('Error adding to watchlist:', error);
      if (error.response?.status === 409) {
        console.log(`Already in watchlist: ${movie.title}`);
      }
      throw error; // Re-throw to let MovieCard handle the error
    }
  };

  const handleRemoveFromWatchlist = async (movie: Movie) => {
    try {
      await watchlistAPI.removeByMovieId(movie.movieId);
      console.log(`Removed from watchlist: ${movie.title}`);
    } catch (error: any) {
      console.error('Error removing from watchlist:', error);
      throw error; // Re-throw to let MovieCard handle the error
    }
  };

  const handleRemove = (movie: Movie) => {
    console.log(`Removed from recommendations: ${movie.title}`);
    // Note: This doesn't actually remove from the list since we'd need state management
    // The user can just swipe to the next movie
  };

  const handleToggleWatched = async (movie: Movie) => {
    if (!movie.historyId) {
      console.warn('No historyId for movie:', movie.title);
      return false;
    }
    try {
      const updated = await historyAPI.markAsWatched(movie.historyId);
      console.log(`Toggled watched status: ${movie.title}`, updated.isWatched);
      // Update the movie in the movies array
      setMovies(prevMovies => 
        prevMovies.map(m => 
          m.historyId === movie.historyId 
            ? { ...m, isWatched: updated.isWatched }
            : m
        )
      );
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
  };

  const handleHome = () => {
    router.replace('/(tabs)/home');
  };

  // Create data array with Generate More button at the end
  const flatListData: FlatListItem[] = [...movies, { isLoadMoreButton: true }];

  const renderItem = ({ item }: { item: FlatListItem }) => {
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
    return (
      <View style={styles.movieContainer}>
        <MovieCard
          movie={movie}
          historyId={movie.historyId}
          initialIsWatched={movie.isWatched || false}
          initialIsNotInterested={movie.isNotInterested || false}
          onAddToWatchlist={() => handleAddToWatchlist(movie)}
          onRemoveFromWatchlist={() => handleRemoveFromWatchlist(movie)}
          onToggleWatched={() => handleToggleWatched(movie)}
          onToggleNotInterested={() => handleToggleNotInterested(movie)}
          onRemove={() => handleRemove(movie)}
        />
      </View>
    );
  };

  if (movies.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Нет рекомендаций</Text>
          <Pressable
            style={styles.homeButton}
            onPress={handleHome}
          >
            <Ionicons name="home" size={24} color={theme.colors.primary} />
            <Text style={styles.homeButtonText}>На главную</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Hide default header and use custom one */}
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable onPress={handleHome} style={styles.homeButtonHeader}>
          <Ionicons name="home" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>Топ-3 для тебя</Text>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        ref={flatListRef}
        data={flatListData}
        renderItem={renderItem}
        keyExtractor={(item, index) => {
          if ('isLoadMoreButton' in item && item.isLoadMoreButton) {
            return 'load-more-button';
          }
          // Use index as primary key to ensure uniqueness (movieIds might duplicate)
          const movie = item as Movie;
          return `movie-${index}-${movie.movieId || 'unknown'}`;
        }}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        getItemLayout={(data, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          // Fallback: scroll to offset if scrollToIndex fails
          const wait = new Promise(resolve => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: true,
            });
          });
        }}
      />

      <View style={styles.pagination}>
        <Pressable
          style={[styles.arrowButton, currentIndex === 0 && styles.arrowButtonDisabled]}
          onPress={goToPrevious}
          disabled={currentIndex === 0}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={currentIndex === 0 ? theme.colors.border : theme.colors.primary}
          />
        </Pressable>
        
        <View style={styles.paginationDots}>
          {movies.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                index === currentIndex && styles.paginationDotActive,
              ]}
            />
          ))}
          {/* Show a special dot for the Generate More button */}
          <View
            style={[
              styles.paginationDot,
              currentIndex === movies.length && styles.paginationDotActive,
              currentIndex === movies.length && styles.paginationDotLoadMore,
            ]}
          />
        </View>
        
        <Pressable
          style={[styles.arrowButton, currentIndex === flatListData.length - 1 && styles.arrowButtonDisabled]}
          onPress={goToNext}
          disabled={currentIndex === flatListData.length - 1}
        >
          <Ionicons
            name="chevron-forward"
            size={24}
            color={currentIndex === flatListData.length - 1 ? theme.colors.border : theme.colors.primary}
          />
        </Pressable>
      </View>
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
  movieContainer: {
    width: SCREEN_WIDTH,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.backgroundDark,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.lg,
  },
  arrowButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  arrowButtonDisabled: {
    opacity: 0.3,
  },
  paginationDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  paginationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.border,
    opacity: 0.5,
  },
  paginationDotActive: {
    backgroundColor: theme.colors.primary,
    width: 32,
    height: 10,
    borderRadius: 5,
    opacity: 1,
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
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
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.backgroundDark,
    borderRadius: theme.borderRadius.md,
  },
  homeButtonText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.md,
  },
  generateMoreContainer: {
    width: SCREEN_WIDTH,
    flex: 1,
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
  paginationDotLoadMore: {
    backgroundColor: theme.colors.secondary,
  },
});
