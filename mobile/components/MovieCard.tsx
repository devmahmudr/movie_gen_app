import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
} from 'react-native';
import { theme } from '../constants/theme';
import { TrailerModal } from './TrailerModal';

interface Movie {
  movieId: string;
  title: string;
  posterPath: string;
  reason?: string;
  genres?: string[];
  releaseYear?: string;
  trailerKey?: string;
}

interface MovieCardProps {
  movie: Movie;
  historyId?: string;
  initialIsWatched?: boolean;
  initialIsNotInterested?: boolean;
  initialIsInWatchlist?: boolean;
  onWatchTrailer?: () => void;
  onAddToWatchlist?: () => void | Promise<void>;
  onRemoveFromWatchlist?: () => void | Promise<void>;
  onToggleWatched?: () => void | Promise<boolean>;
  onToggleNotInterested?: () => void | Promise<boolean>;
  onRemove?: () => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({
  movie,
  historyId,
  initialIsWatched = false,
  initialIsNotInterested = false,
  initialIsInWatchlist = false,
  onWatchTrailer,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  onToggleWatched,
  onToggleNotInterested,
  onRemove,
}) => {
  const [isInWatchlist, setIsInWatchlist] = useState(initialIsInWatchlist);
  const [isWatched, setIsWatched] = useState(initialIsWatched);
  const [isNotInterested, setIsNotInterested] = useState(initialIsNotInterested);
  const [isToggling, setIsToggling] = useState(false);
  const [isTogglingWatched, setIsTogglingWatched] = useState(false);
  const [isTogglingNotInterested, setIsTogglingNotInterested] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);

  // Update state when props change
  useEffect(() => {
    setIsWatched(initialIsWatched);
    setIsNotInterested(initialIsNotInterested);
    setIsInWatchlist(initialIsInWatchlist);
  }, [initialIsWatched, initialIsNotInterested, initialIsInWatchlist]);

  const posterUrl = movie.posterPath.startsWith('http')
    ? movie.posterPath
    : `https://image.tmdb.org/t/p/w500${movie.posterPath}`;

  const handleWatchlistToggle = async () => {
    if (isToggling) return; // Prevent multiple simultaneous toggles
    
    setIsToggling(true);
    const previousState = isInWatchlist;
    
    // Optimistically update UI
    setIsInWatchlist(!isInWatchlist);
    
    try {
      if (!previousState) {
        // Adding to watchlist
        if (onAddToWatchlist) {
          await onAddToWatchlist();
        }
      } else {
        // Removing from watchlist
        if (onRemoveFromWatchlist) {
          await onRemoveFromWatchlist();
        }
      }
    } catch (error: any) {
      // Revert on error, but handle 409 (already in watchlist) gracefully
      if (error.response?.status === 409) {
        // Already in watchlist - just keep the state as true
        setIsInWatchlist(true);
        console.log('Movie already in watchlist');
      } else {
        // Revert on other errors
        setIsInWatchlist(previousState);
        console.error('Error toggling watchlist:', error);
      }
    } finally {
      setIsToggling(false);
    }
  };

  const handleToggleWatched = async () => {
    if (isTogglingWatched || !historyId) return;
    
    setIsTogglingWatched(true);
    const previousState = isWatched;
    
    // Optimistically update UI
    setIsWatched(!isWatched);
    
    try {
      if (onToggleWatched) {
        const newState = await onToggleWatched();
        // Update with actual state from server
        if (typeof newState === 'boolean') {
          setIsWatched(newState);
        }
      }
    } catch (error) {
      // Revert on error
      setIsWatched(previousState);
      console.error('Error toggling watched:', error);
    } finally {
      setIsTogglingWatched(false);
    }
  };

  const handleToggleNotInterested = async () => {
    if (isTogglingNotInterested || !historyId) return;
    
    setIsTogglingNotInterested(true);
    const previousState = isNotInterested;
    
    // Optimistically update UI
    setIsNotInterested(!isNotInterested);
    
    try {
      if (onToggleNotInterested) {
        const newState = await onToggleNotInterested();
        // Update with actual state from server
        if (typeof newState === 'boolean') {
          setIsNotInterested(newState);
        }
      }
    } catch (error) {
      // Revert on error
      setIsNotInterested(previousState);
      console.error('Error toggling not interested:', error);
    } finally {
      setIsTogglingNotInterested(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.posterContainer}>
        <Image source={{ uri: posterUrl }} style={styles.poster} />
      </View>

      <Text style={styles.title}>{movie.title}</Text>
      {movie.releaseYear && (
        <Text style={styles.year}>{movie.releaseYear}</Text>
      )}

      <View style={styles.tagsContainer}>
        {movie.genres?.slice(0, 3).map((genre, index) => (
          <View key={index} style={styles.tag}>
            <Text style={styles.tagText}>{genre}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actionsRow}>
        {movie.trailerKey && (
          <Pressable 
            style={styles.actionButton} 
            onPress={() => setShowTrailer(true)}
          >
            <Text style={styles.actionText}>▶ Смотреть трейлер</Text>
          </Pressable>
        )}
        {/* Placeholder buttons for streaming services */}
        <Pressable style={styles.actionButton}>
          <Text style={styles.actionText}>N Netflix</Text>
        </Pressable>
      </View>

      {movie.trailerKey && (
        <TrailerModal
          visible={showTrailer}
          trailerKey={movie.trailerKey}
          onClose={() => setShowTrailer(false)}
        />
      )}

      <View style={styles.whySection}>
        <Text style={styles.whyTitle}>Почему этот фильм</Text>
        <Text style={styles.whyText}>
          {movie.reason ||
            'Этот фильм идеально подходит под ваши предпочтения. Он сочетает в себе визуальную красоту, захватывающий сюжет и глубокую философию.'}
        </Text>
      </View>

      <View style={styles.bottomActions}>
        {historyId && (
          <Pressable
            style={[styles.toggleButton, isWatched && styles.toggleButtonActive]}
            onPress={handleToggleWatched}
            disabled={isTogglingWatched}
          >
            <Text style={[styles.toggleButtonText, isWatched && styles.toggleButtonTextActive]}>
              {isWatched ? '✓ Уже посмотрено' : 'Уже посмотрено'}
            </Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.toggleButton, isInWatchlist && styles.toggleButtonActive]}
          onPress={handleWatchlistToggle}
          disabled={isToggling}
        >
          <Text style={[styles.toggleButtonText, isInWatchlist && styles.toggleButtonTextActive]}>
            {isInWatchlist ? '❤ В избранное' : '♡ В избранное'}
          </Text>
        </Pressable>
        {historyId && (
          <Pressable
            style={[styles.notInterestedButton, isNotInterested && styles.notInterestedButtonActive]}
            onPress={handleToggleNotInterested}
            disabled={isTogglingNotInterested}
          >
            <Text style={[styles.notInterestedButtonText, isNotInterested && styles.notInterestedButtonTextActive]}>
              {isNotInterested ? '✕ Не интересно' : '✕ Не интересно'}
            </Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.md,
  },
  posterContainer: {
    width: '50%',
    alignSelf: 'center',
    aspectRatio: 2 / 3,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    maxHeight: 300,
  },
  poster: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    marginBottom: theme.spacing.xs,
  },
  year: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    marginBottom: theme.spacing.sm,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  tag: {
    backgroundColor: theme.colors.backgroundDark,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  tagText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  actionText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
  },
  whySection: {
    marginBottom: theme.spacing.lg,
  },
  whyTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  whyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: theme.spacing.md,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundDark,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  toggleButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: '#000',
  },
  notInterestedButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundDark,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  notInterestedButtonActive: {
    backgroundColor: '#ff4444',
    borderColor: '#ff4444',
  },
  notInterestedButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  notInterestedButtonTextActive: {
    color: '#fff',
  },
});

