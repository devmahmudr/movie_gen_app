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
      >
        {item.posterPath && (
          <Image source={{ uri: posterUrl }} style={styles.poster} />
        )}
        <View style={styles.movieInfo}>
          <Text style={styles.movieTitle}>{item.title}</Text>
          <Text style={styles.addedDate}>
            Добавлено: {new Date(item.createdAt).toLocaleDateString('ru-RU')}
          </Text>
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
        <Text style={styles.title}>Избранное</Text>
      </View>
      {movies.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Избранное пусто</Text>
        </View>
      ) : (
        <FlatList
          data={movies}
          renderItem={renderMovie}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
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
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: 'bold',
    color: theme.colors.text,
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
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
  },
  list: {
    padding: theme.spacing.md,
  },
  movieCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.backgroundDark,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  poster: {
    width: 60,
    height: 90,
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing.md,
  },
  movieInfo: {
    flex: 1,
  },
  movieTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  addedDate: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
});

