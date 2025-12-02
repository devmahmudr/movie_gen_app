import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StyledButton } from '../components/StyledButton';
import { theme } from '../constants/theme';
import { useAuthStore } from '../store/authStore';

import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
  const router = useRouter();
  const { token } = useAuthStore();

  const handleStart = () => {
    // Always go to quiz - auth will be checked when generating recommendations
    router.push('/quiz');
  };

  const handleHome = () => {
    router.push('/(tabs)/home');
  };

  return (
    <SafeAreaView style={styles.container}>
      {token && (
        <View style={styles.header}>
          <Pressable onPress={handleHome} style={styles.homeButton}>
            <Ionicons name="home" size={24} color={theme.colors.primary} />
            <Text style={styles.homeButtonText}>Домой</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {/* Film projector/camera icon placeholder */}
          <View style={styles.iconPlaceholder}>
            <Text style={styles.iconText}>🎬</Text>
          </View>
        </View>

        <Text style={styles.headline}>
          Найду тебе что посмотреть за 30 секунд
        </Text>

        <Text style={styles.subtitle}>
          Быстрая персональная подборка фильмов и сериалов
        </Text>

        <View style={styles.buttonContainer}>
          <StyledButton
            title="Начать подбор"
            onPress={handleStart}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  iconContainer: {
    marginBottom: theme.spacing.xl,
  },
  iconPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.backgroundDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  iconText: {
    fontSize: 60,
  },
  headline: {
    fontSize: theme.fontSize.xxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
    marginTop: theme.spacing.xl,
  },
  header: {
    position: 'absolute',
    top: 50, // Adjust based on safe area
    right: 20,
    zIndex: 10,
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundDark,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
  },
  homeButtonText: {
    color: theme.colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
});

