import { useEffect } from 'react';
import { useRouter, useSegments, usePathname } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useAuthStore } from '../store/authStore';
import { useLanguageStore } from '../store/languageStore';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';
import { BottomNavbar } from '../components/BottomNavbar';

export default function RootLayout() {
  const { token, isLoading, loadToken } = useAuthStore();
  const { loadLanguage } = useLanguageStore();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname(); // Move hook before conditional returns

  useEffect(() => {
    loadToken();
    loadLanguage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const firstSegment = segments[0];
    const inAuthGroup = firstSegment === '(auth)';
    const inTabsGroup = firstSegment === '(tabs)';
    const isOnboarding = !firstSegment || firstSegment === 'index';
    const isQuiz = firstSegment === 'quiz';
    const isResults = firstSegment === 'results';

    // Don't redirect if user is on onboarding screen, quiz, or results
    if (isOnboarding || isQuiz || isResults) {
      return;
    }

    // If user is authenticated and in auth group, redirect to tabs
    // (unless they're coming back from auth to quiz - handled in login/register)
    if (token && inAuthGroup) {
      router.replace('/(tabs)/home');
    }
    // If user is not authenticated and trying to access protected routes (tabs)
    // Let the quiz screen handle the auth check when generating recommendations
  }, [token, isLoading, segments, router]);

  // Hide navbar on onboarding, auth pages, or when user is not authenticated
  const hideNavbar = !token || 
                     pathname === '/' || 
                     pathname === '/index' || 
                     pathname?.startsWith('/(auth)');

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            // A smooth 250ms animation is perceived as faster than a flickering 100ms one.
            animationDuration: 250,
            // Set background color to prevent white flash during transitions
            contentStyle: { backgroundColor: theme.colors.background },
            // Additional options to prevent white flash
            animationTypeForReplace: 'push',
            gestureEnabled: true,
            gestureDirection: 'horizontal',
          }}
        >
        <Stack.Screen 
          name="index" 
          options={{
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        />
        <Stack.Screen 
          name="(tabs)" 
          options={{
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        />
        <Stack.Screen 
          name="(auth)/login" 
          options={{
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        />
        <Stack.Screen 
          name="(auth)/register" 
          options={{
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        />
        <Stack.Screen 
          name="quiz" 
          options={{
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        />
        <Stack.Screen 
          name="results" 
          options={{
            contentStyle: { 
              backgroundColor: theme.colors.background,
              paddingBottom: 0, // No padding needed as results doesn't have tab bar
            },
          }}
        />

        {/* You can override the animation for specific screens if needed */}
        <Stack.Screen
          name="watchlist-detail"
          options={{
            // Use slide_from_right for consistency with other screens
            animation: 'slide_from_right',
            animationDuration: 250,
            // Set background color to prevent white flash
            contentStyle: { backgroundColor: theme.colors.background },
            gestureEnabled: true,
            gestureDirection: 'horizontal',
          }}
        />
        </Stack>
        {/* BottomNavbar - visible on all pages except onboarding and auth */}
        {!hideNavbar && <BottomNavbar />}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});

