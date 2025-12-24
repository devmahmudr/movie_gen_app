import React from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { useRouter, usePathname, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';
import { useResultsStore } from '../store/resultsStore';

export const BottomNavbar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { hasResults, resultsNavigation, lastNavigatedFromResults, setLastNavigatedFromResults, clearResults } = useResultsStore();
  
  // Check if we're on the results page
  const isOnResultsPage = pathname === '/results' || 
                         pathname?.startsWith('/results') ||
                         segments[0] === 'results';
  
  // Track previous pathname to detect navigation changes
  const prevPathnameRef = React.useRef<string | null>(null);
  
  // Clear lastNavigatedFromResults when on results page
  React.useEffect(() => {
    if (isOnResultsPage && lastNavigatedFromResults) {
      console.log('[BottomNavbar] On results page, clearing lastNavigatedFromResults');
      setLastNavigatedFromResults(null);
    }
  }, [isOnResultsPage, lastNavigatedFromResults, setLastNavigatedFromResults]);
  
  // Track navigation from results page to other pages
  React.useEffect(() => {
    const prevPathname = prevPathnameRef.current;
    const currentPathname = pathname || '';
    prevPathnameRef.current = currentPathname;
    
    // Check if we were on results page (check both pathname and segments)
    const wasOnResults = prevPathname === '/results' || 
                        prevPathname?.startsWith('/results') ||
                        prevPathname === null; // First load, might be coming from results
    
    // Check if we're now on a tab page (not results)
    const isNowOnTabPage = !isOnResultsPage && 
                           (currentPathname?.startsWith('/(tabs)') || 
                            segments[0] === '(tabs)');
    
    console.log('[BottomNavbar] Navigation tracking:', {
      prevPathname,
      currentPathname,
      wasOnResults,
      isNowOnTabPage,
      isOnResultsPage,
      hasResults,
      segments,
    });
    
    // If we were on results page and now we're on a different page
    if (wasOnResults && isNowOnTabPage && hasResults) {
      // Determine which page we navigated to
      let targetRoute: string | null = null;
      
      // Check watchlist
      if (currentPathname === '/(tabs)/watchlist' || 
          currentPathname?.startsWith('/watchlist') || 
          (segments[0] === '(tabs)' && segments[1] === 'watchlist')) {
        targetRoute = '/(tabs)/watchlist';
      } 
      // Check profile
      else if (currentPathname === '/(tabs)/profile' || 
               (segments[0] === '(tabs)' && segments[1] === 'profile')) {
        targetRoute = '/(tabs)/profile';
      }
      
      if (targetRoute) {
        console.log('[BottomNavbar] ✅ Navigated from results to:', targetRoute);
        setLastNavigatedFromResults(targetRoute);
      }
    }
  }, [pathname, segments, isOnResultsPage, hasResults, setLastNavigatedFromResults]);
  
  // Debug: Log state changes
  React.useEffect(() => {
    console.log('[BottomNavbar] State:', {
      pathname,
      isOnResultsPage,
      hasResults,
      lastNavigatedFromResults,
      segments,
    });
  }, [pathname, isOnResultsPage, hasResults, lastNavigatedFromResults, segments]);

  // Determine which tab should show search button based on navigation from results
  const getTabConfig = (tabName: string, defaultTitle: string, defaultIcon: string, defaultRoute: string) => {
    // If this is the tab that was navigated to from results, show search button
    // Show search button if:
    // 1. We have results
    // 2. We're NOT on results page
    // 3. This tab matches the lastNavigatedFromResults route
    // 4. We have navigation info
    const shouldShowSearch = hasResults && 
                            !isOnResultsPage && 
                            lastNavigatedFromResults === defaultRoute &&
                            resultsNavigation;
    
    console.log(`[BottomNavbar] getTabConfig for ${tabName}:`, {
      shouldShowSearch,
      hasResults,
      isOnResultsPage,
      lastNavigatedFromResults,
      defaultRoute,
      pathname,
      segments,
    });
    
    if (shouldShowSearch) {
      return {
        name: tabName,
        title: 'Поиск',
        icon: 'search',
        route: resultsNavigation!.pathname,
        navigation: resultsNavigation,
        isSearchButton: true,
        originalRoute: defaultRoute,
      };
    }
    
    // Otherwise show normal tab
    return {
      name: tabName,
      title: defaultTitle,
      icon: defaultIcon,
      route: defaultRoute,
      isSearchButton: false,
    };
  };

  const tabs = [
    getTabConfig('home', 'Главная', 'home', '/(tabs)/home'),
    getTabConfig('watchlist', 'Избранное', 'bookmark', '/(tabs)/watchlist'),
    getTabConfig('profile', 'Профиль', 'person', '/(tabs)/profile'),
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

  const handlePress = (route: string, isSearchButton?: boolean, navigation?: any, originalRoute?: string) => {
    console.log('[BottomNavbar] handlePress called:', { route, isSearchButton, isOnResultsPage, hasResults, originalRoute });
    
    if (isSearchButton && navigation) {
      // Navigate to results page with stored params
      console.log('[BottomNavbar] Navigating to results with navigation:', navigation);
      router.push({
        pathname: navigation.pathname,
        params: navigation.params,
      } as any);
    } else if (route === '/(tabs)/home') {
      // Reset navigation history when going to home
      // This clears previous routes so back button exits app
      router.replace('/(tabs)/home' as any);
      // Clear results when going to home (not results)
      if (!isOnResultsPage) {
        clearResults();
      } else {
        // If on results page and clicking home, clear the navigation tracking
        setLastNavigatedFromResults(null);
      }
    } else {
      // Track which page was navigated to (if coming from results)
      // Set it immediately before navigation so it's available when the page loads
      if (isOnResultsPage && hasResults && (route === '/(tabs)/watchlist' || route === '/(tabs)/profile')) {
        console.log('[BottomNavbar] Setting lastNavigatedFromResults to:', route);
        setLastNavigatedFromResults(route);
      }
      console.log('[BottomNavbar] Navigating to:', route);
      router.push(route as any);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((tab) => {
        const active = isActive(tab.route);
        const isSearch = (tab as any).isSearchButton;
        const navigation = (tab as any).navigation;
        const originalRoute = (tab as any).originalRoute;
        // For search button, show as active when on results page
        // For normal tabs, check if we're on the original route
        const isActiveTab = isSearch 
          ? (isOnResultsPage) 
          : active;
        
        return (
          <Pressable
            key={tab.name}
            style={styles.tab}
            onPress={() => handlePress(tab.route, isSearch, navigation, originalRoute)}
          >
            <View style={styles.iconContainer}>
              {/* Filled background circle for active state */}
              {isActiveTab && (
                <View style={styles.activeIndicator} />
              )}
              <Ionicons
                name={(isActiveTab ? tab.icon : `${tab.icon}-outline`) as any}
                size={24}
                color={isActiveTab ? theme.colors.primary : theme.colors.textSecondary}
                style={styles.icon}
              />
            </View>
            <Text
              style={[
                styles.tabLabel,
                isActiveTab && styles.tabLabelActive,
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

