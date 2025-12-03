import React from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

export const BottomNavbar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();

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
    if (route === '/(tabs)/home') {
      return pathname === '/(tabs)/home' || pathname === '/';
    }
    return pathname === route;
  };

  const handlePress = (route: string) => {
    router.push(route as any);
  };

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const active = isActive(tab.route);
        return (
          <Pressable
            key={tab.name}
            style={styles.tab}
            onPress={() => handlePress(tab.route)}
          >
            <Ionicons
              name={active ? tab.icon : `${tab.icon}-outline`}
              size={24}
              color={active ? theme.colors.primary : theme.colors.textSecondary}
            />
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
    paddingBottom: 8,
    paddingTop: 8,
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 1000,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
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

