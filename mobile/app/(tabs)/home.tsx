import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  Dimensions,
  BackHandler,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StyledButton } from '../../components/StyledButton';
import { theme } from '../../constants/theme';
import { useCallback } from 'react';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();

  // Handle back button to exit app when on home page
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // Exit app when back button is pressed on home page
        BackHandler.exitApp();
        return true; // Prevent default back behavior
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => subscription.remove();
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {/* Placeholder for camera icon - replace with actual image */}
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
            onPress={() => router.push('/quiz')}
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
});

