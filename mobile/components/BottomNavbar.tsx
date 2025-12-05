import React from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { useRouter, usePathname, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';

export const BottomNavbar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  
  // Debug: Log pathname and segments to help troubleshoot
  // React.useEffect(() => {
  //   console.log('[BottomNavbar] Current pathname:', pathname, 'segments:', segments);
  // }, [pathname, segments]);

  const tabs = [
    {
      name: 'home',
      title: 'Главная',
      icon: 'home',
      route: '/(tabs)/home',
    },
    {
      name: 'watchlist',
      title: 'Избранное',
      icon: 'bookmark',
      route: '/(tabs)/watchlist',
    },
    {
      name: 'profile',
      title: 'Профиль',
      icon: 'person',
      route: '/(tabs)/profile',
    },
  ];

  const isActive = (route: string) => {
    // Normalize pathname for comparison
    const normalizedPathname = pathname || '';
    const firstSegment = segments[0];
    // Safely access second segment
    const segmentsArray = Array.isArray(segments) ? segments : [segments];
    const secondSegment = segmentsArray.length > 1 ? segmentsArray[1] : undefined;
    
    if (route === '/(tabs)/home') {
      // Home is active on home, quiz, results, or root
      return normalizedPathname === '/(tabs)/home' || 
             normalizedPathname === '/' || 
             normalizedPathname === '/index' ||
             normalizedPathname === '/quiz' || 
             normalizedPathname === '/results' ||
             (firstSegment === '(tabs)' && secondSegment === 'home') ||
             !firstSegment || firstSegment === 'index';
    } else if (route === '/(tabs)/watchlist') {
      // Watchlist is active on watchlist or watchlist-detail
      return normalizedPathname === '/(tabs)/watchlist' ||
             normalizedPathname?.startsWith('/watchlist') ||
             (firstSegment === '(tabs)' && secondSegment === 'watchlist');
    } else if (route === '/(tabs)/profile') {
      // Profile is active only on profile
      return normalizedPathname === '/(tabs)/profile' ||
             (firstSegment === '(tabs)' && secondSegment === 'profile');
    }
    return false;
  };

  const handlePress = (route: string) => {
    if (route === '/(tabs)/home') {
      // Reset navigation history when going to home
      // This clears previous routes so back button exits app
      router.replace('/(tabs)/home' as any);
    } else {
      router.push(route as any);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((tab) => {
        const active = isActive(tab.route);
        return (
          <Pressable
            key={tab.name}
            style={styles.tab}
            onPress={() => handlePress(tab.route)}
          >
            <View style={styles.iconContainer}>
              {/* Filled background circle for active state */}
              {active && (
                <View style={styles.activeIndicator} />
              )}
              <Ionicons
                name={(active ? tab.icon : `${tab.icon}-outline`) as any}
                size={24}
                color={active ? theme.colors.primary : theme.colors.textSecondary}
                style={styles.icon}
              />
            </View>
            <Text
              style={[
                styles.tabLabel,
                active && styles.tabLabelActive,
              ]}
            >
              {tab.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: theme.colors.backgroundDark,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    paddingTop: 6,
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 1000,
    minHeight: 60,
    // paddingBottom is set dynamically based on safe area insets
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  iconContainer: {
    position: 'relative',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    zIndex: 1,
  },
  activeIndicator: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${theme.colors.primary}20`, // 20% opacity filled background
    zIndex: 0,
  },
  tabLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  tabLabelActive: {
    color: theme.colors.primary,
  },
});

