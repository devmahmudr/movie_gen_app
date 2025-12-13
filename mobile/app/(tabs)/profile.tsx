import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StyledButton } from '../../components/StyledButton';
import { useAuthStore } from '../../store/authStore';
import { useLanguageStore } from '../../store/languageStore';
import { userAPI } from '../../services/apiClient';
import { theme } from '../../constants/theme';

export default function ProfileScreen() {
  const { logout, token } = useAuthStore();
  const { language, loadLanguage } = useLanguageStore();
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string } | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLanguage();
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProfile = async () => {
    try {
      const profile = await userAPI.getProfile();
      setUser(profile);
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    // Redirect to main screen (index)
    router.replace('/');
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={[theme.colors.primary + '40', theme.colors.secondary + '40']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarGradient}
              >
                <Ionicons name="person" size={40} color={theme.colors.primary} />
              </LinearGradient>
            </View>
            <Text style={styles.profileTitle}>Профиль</Text>
          </View>
        </View>

        {/* Email Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              <Ionicons name="mail-outline" size={20} color={theme.colors.primary} />
            </View>
            <Text style={styles.cardLabel}>Email</Text>
          </View>
          <Text style={styles.cardValue}>{user?.email || 'Не загружено'}</Text>
        </View>

        {/* Language Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              <Ionicons name="language-outline" size={20} color={theme.colors.primary} />
            </View>
            <Text style={styles.cardLabel}>Язык интерфейса</Text>
          </View>
          <View style={styles.languageSelector}>
            <Pressable
              style={[
                styles.languageOption,
                language === 'ru' && styles.languageOptionActive,
              ]}
              onPress={() => useLanguageStore.getState().setLanguage('ru')}
            >
              <View style={styles.languageOptionLeft}>
                <Ionicons
                  name="flag"
                  size={20}
                  color={language === 'ru' ? theme.colors.primary : theme.colors.textSecondary}
                  style={styles.languageIcon}
                />
                <Text
                  style={[
                    styles.languageOptionText,
                    language === 'ru' && styles.languageOptionTextActive,
                  ]}
                >
                  Русский
                </Text>
              </View>
              {language === 'ru' && (
                <View style={styles.checkmarkContainer}>
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={theme.colors.primary}
                  />
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* Logout Button */}
        <Pressable
          style={styles.logoutButton}
          onPress={handleLogout}
          android_ripple={{ color: 'rgba(255, 255, 255, 0.1)' }}
        >
          <View style={styles.logoutButtonContent}>
            <Ionicons name="log-out-outline" size={22} color={theme.colors.error} />
            <Text style={styles.logoutButtonText}>Выйти из аккаунта</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 100, // Extra padding for navbar
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  profileHeader: {
    alignItems: 'center',
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  avatarContainer: {
    marginBottom: theme.spacing.md,
  },
  avatarGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary + '60',
  },
  profileTitle: {
    fontSize: theme.fontSize.xxl,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  card: {
    backgroundColor: theme.colors.backgroundDark,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  cardLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardValue: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
    fontWeight: '600',
    marginTop: theme.spacing.xs,
  },
  languageSelector: {
    marginTop: theme.spacing.sm,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  languageOptionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.backgroundDark,
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  languageOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  languageIcon: {
    marginRight: theme.spacing.sm,
  },
  languageOptionText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  languageOptionTextActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  checkmarkContainer: {
    marginLeft: theme.spacing.sm,
  },
  logoutButton: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.backgroundDark,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.error + '40',
    overflow: 'hidden',
  },
  logoutButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  logoutButtonText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.error,
    fontWeight: '600',
  },
});

