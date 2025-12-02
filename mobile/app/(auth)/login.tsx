import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyledInput } from '../../components/StyledInput';
import { StyledButton } from '../../components/StyledButton';
import { authAPI } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';
import { theme } from '../../constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuthStore();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Пожалуйста, заполните все поля');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login(email, password);
      await login(response.accessToken);
      
      // Check if there's a pending quiz state
      try {
        const savedState = await AsyncStorage.getItem('pending_quiz_state');
        
        if (savedState) {
          // Redirect back to quiz (state will be restored there)
          router.replace('/quiz');
        } else {
          // Normal navigation - will be handled by root layout
          router.replace('/(tabs)/home');
        }
      } catch (error) {
        // If AsyncStorage fails, just do normal navigation
        router.replace('/(tabs)/home');
      }
    } catch (err: any) {
      // Better error messages
      const isNetworkError = 
        !err.response && 
        (err.code === 'ECONNREFUSED' || 
         err.code === 'ENOTFOUND' || 
         err.code === 'ETIMEDOUT' ||
         err.message?.includes('Network Error') ||
         err.message?.includes('network request failed'));
      
      if (isNetworkError) {
        setError('Не удалось подключиться к серверу. Проверьте подключение и настройки API. Для физического устройства используйте IP адрес компьютера.');
      } else if (err.response?.status === 401) {
        setError('Неверный email или пароль');
      } else {
        setError(
          err.response?.data?.message || 'Ошибка входа. Проверьте данные.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.title}>Вход</Text>

          <StyledInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            error={error && !email ? error : undefined}
          />

          <StyledInput
            value={password}
            onChangeText={setPassword}
            placeholder="Пароль"
            secureTextEntry
            error={error && !password ? error : undefined}
          />

          {error && email && password && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          <StyledButton
            title="Войти"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
          />

          <Text
            style={styles.linkText}
            onPress={() => router.push('/(auth)/register')}
          >
            Нет аккаунта? Зарегистрироваться
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    fontSize: theme.fontSize.xxxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  linkText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.md,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
    textDecorationLine: 'underline',
  },
});

