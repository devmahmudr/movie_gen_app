import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
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
      <View style={styles.content}>
        <View style={styles.profileSection}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.email}>{user?.email || 'Не загружено'}</Text>
        </View>

        <View style={styles.profileSection}>
          <Text style={styles.label}>Язык интерфейса</Text>
          <View style={styles.languageSelector}>
            <Pressable
              style={[
                styles.languageOption,
                language === 'ru' && styles.languageOptionActive,
              ]}
              onPress={() => useLanguageStore.getState().setLanguage('ru')}
            >
              <Text
                style={[
                  styles.languageOptionText,
                  language === 'ru' && styles.languageOptionTextActive,
                ]}
              >
                Русский
              </Text>
              {language === 'ru' && (
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={theme.colors.primary}
                />
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <StyledButton title="Выйти" onPress={handleLogout} />
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
    padding: theme.spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileSection: {
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.backgroundDark,
    borderRadius: theme.borderRadius.md,
  },
  label: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  email: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: theme.spacing.xl,
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
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  languageOptionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.backgroundDark,
  },
  languageOptionText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  languageOptionTextActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
});

