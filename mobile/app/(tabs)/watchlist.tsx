import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Image,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { watchlistAPI } from '../../services/apiClient';
import { theme } from '../../constants/theme';

interface WatchlistItem {
  id: string;
  movieId: string;
  title: string;
  posterPath: string;
  createdAt: string;
}

export default function WatchlistScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [movies, setMovies] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadWatchlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadWatchlist = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const response = await watchlistAPI.getWatchlist();
      setMovies(response || []);
      setError('');
    } catch (err: any) {
      setError('Не удалось загрузить избранное');
      console.error('Error loading watchlist:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    loadWatchlist(true);
  };

  const handleMoviePress = (item: WatchlistItem) => {
    router.push({
      pathname: '/watchlist-detail',
      params: { movieId: item.movieId },
    });
  };

  const renderMovie = ({ item }: { item: WatchlistItem }) => {
    const posterUrl = item.posterPath?.startsWith('http')
      ? item.posterPath
      : `https://image.tmdb.org/t/p/w200${item.posterPath}`;

    return (
      <Pressable
        style={styles.movieCard}
        onPress={() => handleMoviePress(item)}
        android_ripple={{ color: 'rgba(255, 255, 255, 0.1)' }}
      >
        <View style={styles.posterContainer}>
          {item.posterPath ? (
            <Image source={{ uri: posterUrl }} style={styles.poster} />
          ) : (
            <View style={styles.posterPlaceholder}>
              <Ionicons name="film-outline" size={32} color={theme.colors.textSecondary} />
            </View>
          )}
        </View>
        <View style={styles.movieInfo}>
          <Text style={styles.movieTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.dateContainer}>
            <Ionicons name="calendar-outline" size={14} color={theme.colors.textSecondary} />
            <Text style={styles.addedDate}>
              {new Date(item.createdAt).toLocaleDateString('ru-RU')}
            </Text>
          </View>
        </View>
        <View style={styles.arrowContainer}>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.iconContainer}>
            <Ionicons name="bookmark" size={24} color={theme.colors.primary} />
          </View>
          <Text style={styles.title}>Избранное</Text>
        </View>
        {movies.length > 0 && (
          <Text style={styles.subtitle}>{movies.length} {movies.length === 1 ? 'фильм' : 'фильмов'}</Text>
        )}
      </View>
      {movies.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="bookmark-outline" size={64} color={theme.colors.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>Избранное пусто</Text>
          <Text style={styles.emptyText}>
            Добавляйте фильмы в избранное, чтобы не потерять их
          </Text>
        </View>
      ) : (
        <FlatList
          data={movies}
          renderItem={renderMovie}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: Math.max(insets.bottom, 8) + 80 } // Navbar height (~60px) + safe area + extra space
          ]}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginLeft: 52, // Align with title (icon width + margin)
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.backgroundDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  list: {
    padding: theme.spacing.md,
  },
  movieCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.backgroundDark,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  posterContainer: {
    marginRight: theme.spacing.md,
  },
  poster: {
    width: 70,
    height: 105,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
  },
  posterPlaceholder: {
    width: 70,
    height: 105,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  movieInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  movieTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
    lineHeight: 22,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  addedDate: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  arrowContainer: {
    marginLeft: theme.spacing.sm,
  },
});

