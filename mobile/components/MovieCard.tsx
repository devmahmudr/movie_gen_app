import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageStyle,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { TrailerModal } from './TrailerModal';
import { RatingModal } from './RatingModal';

interface Movie {
  movieId: string;
  title: string;
  posterPath: string;
  reason?: string;
  genres?: string[];
  releaseYear?: string;
  trailerKey?: string;
  overview?: string;
  country?: string;
  imdbRating?: number;
  publicRating?: number; // Average rating from all users in the app
  runtime?: number; // Duration in minutes
  ageRating?: string; // Age restriction/certification (e.g., "PG-13", "R", "16+")
}

interface MovieCardProps {
  movie: Movie;
  historyId?: string;
  initialIsWatched?: boolean;
  initialIsNotInterested?: boolean;
  initialIsInWatchlist?: boolean;
  initialUserRating?: number | null;
  onWatchTrailer?: () => void;
  onToggleWatchlist?: () => Promise<boolean>;
  onToggleWatched?: () => void | Promise<boolean>;
  onToggleNotInterested?: () => void | Promise<boolean>;
  onRate?: (rating: number) => Promise<void>;
  onRemove?: () => void;
}

export const MovieCard: React.FC<MovieCardProps> = React.memo(({
  movie,
  historyId,
  initialIsWatched = false,
  initialIsNotInterested = false,
  initialIsInWatchlist = false,
  initialUserRating = null,
  onWatchTrailer,
  onToggleWatchlist,
  onToggleWatched,
  onToggleNotInterested,
  onRate,
  onRemove,
}) => {
  const [isInWatchlist, setIsInWatchlist] = useState(initialIsInWatchlist);
  const [isWatched, setIsWatched] = useState(initialIsWatched);
  const [isNotInterested, setIsNotInterested] = useState(initialIsNotInterested);
  const [userRating, setUserRating] = useState<number | null>(initialUserRating);
  const [isToggling, setIsToggling] = useState(false);
  const [isTogglingWatched, setIsTogglingWatched] = useState(false);
  const [isTogglingNotInterested, setIsTogglingNotInterested] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // Update state when props change
  useEffect(() => {
    setIsWatched(initialIsWatched);
    setIsNotInterested(initialIsNotInterested);
    setIsInWatchlist(initialIsInWatchlist);
    setUserRating(initialUserRating);
    
    // Update opacity animation when isNotInterested prop changes
    if (initialIsNotInterested) {
      opacityAnim.setValue(0.3);
    } else {
      opacityAnim.setValue(1);
    }
  }, [initialIsWatched, initialIsNotInterested, initialIsInWatchlist, initialUserRating, opacityAnim]);

  const posterUrl = movie.posterPath.startsWith('http')
    ? movie.posterPath
    : `https://image.tmdb.org/t/p/w500${movie.posterPath}`;

  const handleWatchlistToggle = async () => {
    if (isToggling || !onToggleWatchlist) return; // Prevent multiple simultaneous toggles
    
    setIsToggling(true);
    const previousState = isInWatchlist;
    
    // Optimistically update UI
    setIsInWatchlist(!isInWatchlist);
    
    try {
      const isAdded = await onToggleWatchlist();
      // Update state based on actual result from server
      setIsInWatchlist(isAdded);
    } catch (error: any) {
      // Revert on error
        setIsInWatchlist(previousState);
        console.error('Error toggling watchlist:', error);
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

  const handleRate = async (rating: number) => {
    if (!onRate || !historyId) return;
    try {
      await onRate(rating);
      setUserRating(rating);
      // Once rated, mark as watched (implicitly)
      setIsWatched(true);
    } catch (error) {
      console.error('Error rating movie:', error);
      throw error;
    }
  };

  const handleToggleNotInterested = async () => {
    if (isTogglingNotInterested || !historyId) return;
    
    setIsTogglingNotInterested(true);
    const previousState = isNotInterested;
    
    // If marking as not interested (true), animate opacity decrease
    if (!isNotInterested) {
      Animated.timing(opacityAnim, {
        toValue: 0.3,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
    
    // Optimistically update UI
    setIsNotInterested(!isNotInterested);
    
    try {
      if (onToggleNotInterested) {
        const newState = await onToggleNotInterested();
        // Update with actual state from server
        if (typeof newState === 'boolean') {
          setIsNotInterested(newState);
          // If still not interested, keep opacity low; otherwise restore
          if (newState) {
            Animated.timing(opacityAnim, {
              toValue: 0.3,
              duration: 200,
              useNativeDriver: true,
            }).start();
          } else {
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }).start();
          }
        }
      }
    } catch (error) {
      // Revert on error - restore opacity and state
      setIsNotInterested(previousState);
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      console.error('Error toggling not interested:', error);
    } finally {
      setIsTogglingNotInterested(false);
    }
  };

  // Use View instead of ScrollView when inside FlatList to prevent nested scrolling issues
  // Directly use View to avoid creating component on each render (prevents blinking)
  return (
    <Animated.View style={[styles.container, { opacity: opacityAnim }]}>
      <View style={styles.posterSectionContainer}>
        {/* Full-width blurred background effect */}
        <View style={styles.posterBackgroundContainer}>
          <Image 
            source={{ uri: posterUrl }} 
            style={styles.posterBackground}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <BlurView
            intensity={80}
            tint="dark"
            style={styles.blurOverlay}
          />
          <LinearGradient
            colors={[
              'rgba(0, 0, 0, 0.1)', 
              'rgba(0, 0, 0, 0.3)', 
              'rgba(0, 0, 0, 0.6)',
              'rgba(0, 0, 0, 0.85)'
            ]}
            style={styles.posterGradientOverlay}
          />
        </View>
        
        {/* Centered poster with shadow */}
      <View style={styles.posterContainer}>
          <View style={styles.posterWrapper}>
            <Image 
              source={{ uri: posterUrl }} 
              style={styles.poster}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
          </View>
        </View>
      </View>

      <Text style={styles.title}>{movie.title}</Text>
      <View style={styles.metaRow}>
      {movie.releaseYear && (
        <Text style={styles.year}>{movie.releaseYear}</Text>
      )}
        {movie.runtime && (
          <>
            {movie.releaseYear && <Text style={styles.metaSeparator}> | </Text>}
            <Text style={styles.runtime}>{movie.runtime} мин</Text>
          </>
        )}
        {movie.ageRating && (
          <>
            {(movie.releaseYear || movie.runtime) && <Text style={styles.metaSeparator}> | </Text>}
            <Text style={styles.ageRating}>
              {movie.ageRating.includes('+') ? movie.ageRating : `${movie.ageRating}+`}
            </Text>
          </>
        )}
        {movie.country && (
          <>
            {(movie.releaseYear || movie.runtime || movie.ageRating) && <Text style={styles.metaSeparator}> | </Text>}
            <Text style={styles.country}>{movie.country}</Text>
          </>
        )}
        {movie.imdbRating && (
          <>
            {(movie.releaseYear || movie.runtime || movie.ageRating || movie.country) && <Text style={styles.metaSeparator}> | </Text>}
            <View style={styles.imdbContainer}>
              <Text style={styles.imdbText}>IMDb</Text>
              <Text style={styles.imdbRating}>{movie.imdbRating.toFixed(1)}</Text>
            </View>
          </>
        )}
        {movie.publicRating && (
          <>
            {(movie.releaseYear || movie.runtime || movie.ageRating || movie.country || movie.imdbRating) && <Text style={styles.metaSeparator}> | </Text>}
            <View style={styles.publicRatingContainer}>
              <Ionicons name="star" size={14} color={theme.colors.rating} />
              <Text style={styles.publicRating}>{movie.publicRating.toFixed(1)}</Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.tagsContainer}>
        {movie.genres?.slice(0, 3).map((genre, index) => (
          <View key={index} style={styles.tag}>
            <Text style={styles.tagText}>{genre}</Text>
          </View>
        ))}
      </View>

      <View style={styles.trailerButtonContainer}>
        {movie.trailerKey ? (
          <>
          <Pressable 
              style={styles.trailerButton} 
            onPress={() => setShowTrailer(true)}
          >
              <View style={styles.trailerButtonContent}>
                <View style={styles.playButtonCircle}>
                  <Ionicons name="play" size={16} color="#000000" />
                </View>
                <Text style={styles.trailerButtonText}>Смотреть трейлер</Text>
              </View>
        </Pressable>
        <TrailerModal
          visible={showTrailer}
          trailerKey={movie.trailerKey}
          onClose={() => setShowTrailer(false)}
        />
          </>
        ) : (
          <View style={styles.noTrailerContainer}>
            <Ionicons 
              name="videocam-off-outline" 
              size={24} 
              color={theme.colors.textSecondary} 
            />
            <Text style={styles.noTrailerText}>
              Трейлер недоступен
            </Text>
            <Text style={styles.noTrailerSubtext}>
              Для этого фильма трейлер не найден
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actionIconsRow}>
        {historyId && (
          <Pressable
            style={styles.actionIconButton}
            onPress={() => setShowRatingModal(true)}
            disabled={isTogglingWatched}
          >
            <Ionicons 
              name={userRating ? "star" : "star-outline"} 
              size={24} 
              color={userRating ? theme.colors.rating : theme.colors.textSecondary} 
            />
            <Text style={[styles.actionIconText, userRating !== null && userRating !== undefined && styles.actionIconTextActive]}>
              {userRating ? `${userRating}/10` : 'Оценить'}
            </Text>
          </Pressable>
        )}

        <Pressable
          style={styles.actionIconButton}
          onPress={handleWatchlistToggle}
          disabled={isToggling}
        >
          <Ionicons 
            name={isInWatchlist ? "bookmark" : "bookmark-outline"} 
            size={24} 
            color={isInWatchlist ? theme.colors.primary : theme.colors.textSecondary} 
          />
          <Text style={[styles.actionIconText, isInWatchlist && styles.actionIconTextActive]}>
            Буду смотреть
          </Text>
        </Pressable>

        {historyId && (
          <Pressable
            style={styles.actionIconButton}
            onPress={handleToggleNotInterested}
            disabled={isTogglingNotInterested}
          >
            <Ionicons 
              name={isNotInterested ? "close-circle" : "close-circle-outline"} 
              size={24} 
              color={isNotInterested ? theme.colors.error : theme.colors.textSecondary} 
            />
            <Text style={[styles.actionIconText, isNotInterested && styles.actionIconTextError]}>
              Не интересно
            </Text>
          </Pressable>
        )}
      </View>

      {movie.overview && (
        <View style={styles.whySection}>
          <Pressable 
            style={styles.whyHeader}
            onPress={() => setIsOverviewExpanded(!isOverviewExpanded)}
          >
            <Text style={styles.whyTitle}>О фильме</Text>
            <Ionicons 
              name={isOverviewExpanded ? "chevron-up" : "chevron-down"} 
              size={20} 
              color={theme.colors.textSecondary}
              style={[
                styles.chevronIcon,
                isOverviewExpanded && styles.chevronIconExpanded
              ]}
            />
          </Pressable>
          <Text 
            style={styles.whyText}
            numberOfLines={isOverviewExpanded ? undefined : 2}
            ellipsizeMode="tail"
          >
            {movie.overview}
          </Text>
        </View>
      )}

      {historyId && onRate && (
        <RatingModal
          visible={showRatingModal}
          currentRating={userRating}
          onClose={() => setShowRatingModal(false)}
          onRate={handleRate}
          movieTitle={movie.title}
        />
      )}
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.movie.movieId === nextProps.movie.movieId &&
    prevProps.historyId === nextProps.historyId &&
    prevProps.initialIsWatched === nextProps.initialIsWatched &&
    prevProps.initialIsNotInterested === nextProps.initialIsNotInterested &&
    prevProps.initialIsInWatchlist === nextProps.initialIsInWatchlist &&
    prevProps.initialUserRating === nextProps.initialUserRating
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent', // Ensure transparent background
    width: '100%',
    padding: theme.spacing.md,
    // Prevent layout shifts that cause blinking
    minHeight: 100,
  },
  posterSectionContainer: {
    width: '100%',
    marginBottom: theme.spacing.md,
    position: 'relative',
    minHeight: 400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  posterBackgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    zIndex: 0,
  },
  posterBackground: {
    width: '100%',
    height: '100%',
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  posterGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  posterContainer: {
    width: '50%',
    aspectRatio: 2 / 3,
    maxHeight: 300,
    zIndex: 1,
    position: 'relative',
  },
  posterWrapper: {
    width: '100%',
    height: '100%',
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
    backgroundColor: 'transparent',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    marginBottom: theme.spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  year: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
  },
  metaSeparator: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    marginHorizontal: theme.spacing.xs,
  },
  runtime: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
  },
  ageRating: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  country: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
  },
  imdbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  imdbText: {
    color: '#F5C518',
    fontSize: theme.fontSize.sm,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  imdbRating: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  publicRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  publicRating: {
    color: theme.colors.rating,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
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
  trailerButtonContainer: {
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
  },
  trailerButton: {
    width: '100%',
    maxWidth: 300,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.backgroundDark,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
  },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  noTrailerContainer: {
    width: '100%',
    maxWidth: 300,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.backgroundDark,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  noTrailerText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    fontWeight: '500',
    textAlign: 'center',
  },
  noTrailerSubtext: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    textAlign: 'center',
    opacity: 0.7,
  },
  trailerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  playButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  trailerButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  whySection: {
    marginBottom: theme.spacing.lg,
  },
  whyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  whyTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    flex: 1,
  },
  chevronIcon: {
    marginLeft: theme.spacing.sm,
    transform: [{ rotate: '0deg' }],
  },
  chevronIconExpanded: {
    transform: [{ rotate: '180deg' }],
  },
  whyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
  },
  actionIconsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  actionIconButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  actionIconText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  actionIconTextActive: {
    color: theme.colors.primary,
  },
  actionIconTextError: {
    color: theme.colors.error,
  },
});

