import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Pressable,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { recommendationsAPI } from '../services/apiClient';
import { theme } from '../constants/theme';
import { StyledInput } from '../components/StyledInput';
import { useAuthStore } from '../store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface QuizAnswers {
  context?: string;
  moods: string[];
  tags: string[];
  similarTo?: string;
  format?: string;
}

const QUIZ_STEPS = [
  {
    question: 'С кем смотришь?',
    options: [
      'Один',
      'С девушкой/парнем',
      'С друзьями',
      'С семьёй',
      'Хочу фоновый фильм',
    ],
    key: 'context' as keyof QuizAnswers,
  },
  {
    question: 'Настроение (1–2 эмоции)',
    options: [
      'Расслабиться',
      'Поднять настроение',
      'Посмеяться',
      'Удивиться',
      'Почувствовать уют/тепло',
      'Адреналин',
      'Погрузиться в атмосферу',
      'Вдохновиться',
      'Чуть попереживать',
      'Немного попугаться',
    ],
    key: 'moods' as keyof QuizAnswers,
    multiple: true,
    maxSelections: 2,
  },
  {
    question: 'Атмосфера / сюжетные мотивы (1–2 тега)',
    options: [
      '🛸 Пришельцы',
      '👁 Мистика',
      '🌀 Загадочность',
      '🌌 Космос',
      '🕳 Психологический триллер',
      '🔍 Расследование',
      '🎭 Мощная эмоция',
      '🎢 Неожиданный финал',
      '⏳ Временная петля',
      '🤖 Роботы / ИИ',
      '🌆 Будущее / киберпанк',
      '🔥 Экшен',
      'Война',
      'Криминал',
      '🧠 Глубокий смысл',
      '🌿 Природная атмосфера',
      '🏡 Уют',
    ],
    key: 'tags' as keyof QuizAnswers,
    multiple: true,
    maxSelections: 2,
  },
  {
    question: 'Есть фильм, который хотел бы типа того?',
    key: 'similarTo' as keyof QuizAnswers,
    optional: true,
    input: true, // This is an input field
  },
  {
    question: 'Формат',
    options: ['Фильм', 'Сериал', 'Оба'],
    key: 'format' as keyof QuizAnswers,
  },
];

const QUIZ_STATE_KEY = 'pending_quiz_state';

export default function QuizScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({
    moods: [],
    tags: [],
  });
  const [loading, setLoading] = useState(false);
  const [similarToInput, setSimilarToInput] = useState('');

  // Restore quiz state if coming back from auth
  useEffect(() => {
    const restoreQuizState = async () => {
      try {
        const savedState = await AsyncStorage.getItem(QUIZ_STATE_KEY);
        if (savedState) {
          const { step, answers: savedAnswers, similarTo } = JSON.parse(savedState);
          setCurrentStep(step);
          setAnswers(savedAnswers);
          if (similarTo) {
            setSimilarToInput(similarTo);
          }
          // Clear saved state after restoring
          await AsyncStorage.removeItem(QUIZ_STATE_KEY);
        }
      } catch (error) {
        console.error('Error restoring quiz state:', error);
      }
    };
    restoreQuizState();
  }, []);

  const currentQuestion = QUIZ_STEPS[currentStep];
  const progress = ((currentStep + 1) / QUIZ_STEPS.length) * 100;

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      router.back();
    }
  };

  const handleAnswer = (option: string) => {
    if (currentQuestion.multiple) {
      const currentAnswers = (answers[currentQuestion.key] as string[]) || [];
      const isSelected = currentAnswers.includes(option);

      if (isSelected) {
        // Deselect
        const newAnswers = currentAnswers.filter((a) => a !== option);
        setAnswers({ ...answers, [currentQuestion.key]: newAnswers });
      } else {
        // Select (if under max)
        if (
          currentAnswers.length < (currentQuestion.maxSelections || 2)
        ) {
          setAnswers({
            ...answers,
            [currentQuestion.key]: [...currentAnswers, option],
          });
        }
      }
    } else {
      setAnswers({ ...answers, [currentQuestion.key]: option });
    }
  };

  const canProceed = () => {
    if (currentQuestion.optional) return true;
    if (currentQuestion.input) return true; // Input field is always valid
    if (currentQuestion.multiple) {
      const selected = (answers[currentQuestion.key] as string[]) || [];
      return selected.length > 0;
    }
    return !!answers[currentQuestion.key];
  };

  const handleNext = () => {
    // Save input value for similarTo question
    if (currentQuestion.input && similarToInput.trim()) {
      setAnswers({ ...answers, [currentQuestion.key]: similarToInput.trim() });
    }
    
    if (currentStep < QUIZ_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      // Reset input when moving to next question
      if (currentQuestion.input) {
        setSimilarToInput('');
      }
    } else {
      submitQuiz();
    }
  };

  const handleSkip = () => {
    setAnswers({ ...answers, [currentQuestion.key]: undefined });
    if (currentStep < QUIZ_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      submitQuiz();
    }
  };

  const submitQuiz = async () => {
    // Check authentication before generating recommendations
    if (!token) {
      // Save quiz state before redirecting to auth
      try {
        await AsyncStorage.setItem(QUIZ_STATE_KEY, JSON.stringify({
          step: currentStep,
          answers,
          similarTo: similarToInput,
        }));
      } catch (error) {
        console.error('Error saving quiz state:', error);
      }
      alert('Для получения рекомендаций необходимо войти в систему');
      router.push('/(auth)/login');
      return;
    }

    setLoading(true);
    try {
      console.log('Submitting quiz with answers:', answers);
      const response = await recommendationsAPI.getRecommendations({
        context: answers.context || 'Один',
        moods: answers.moods,
        tags: answers.tags,
        similarTo: answers.similarTo,
        format: answers.format || 'Оба',
      });

      console.log('Recommendations received:', response);
      
      if (!response || !Array.isArray(response) || response.length === 0) {
        throw new Error('No recommendations received');
      }

      router.push({
        pathname: '/results',
        params: { 
          movies: JSON.stringify(response),
          quizAnswers: JSON.stringify({
            context: answers.context || 'Один',
            moods: answers.moods,
            tags: answers.tags,
            similarTo: answers.similarTo,
            format: answers.format || 'Оба',
          }),
        },
      });
    } catch (error: any) {
      console.error('Error getting recommendations:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
      });
      
      let errorMessage = 'Ошибка получения рекомендаций. Попробуйте снова.';
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = 'Запрос занял слишком много времени. Попробуйте снова.';
      } else if (error.message?.includes('Network Error')) {
        errorMessage = 'Ошибка подключения к серверу. Проверьте подключение.';
      }
      
      alert(errorMessage);
      setLoading(false);
    }
  };

  const isSelected = (option: string) => {
    if (currentQuestion.multiple) {
      const currentAnswers = (answers[currentQuestion.key] as string[]) || [];
      return currentAnswers.includes(option);
    }
    return answers[currentQuestion.key] === option;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Ищем идеальные фильмы...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Шаг {currentStep + 1} из {QUIZ_STEPS.length}
          </Text>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progress}%` }]} />
          </View>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.question}>{currentQuestion.question}</Text>
        {currentQuestion.optional && !currentQuestion.input && (
          <Text style={styles.optionalText}>(необязательно)</Text>
        )}

        {currentQuestion.input ? (
          <View style={styles.inputContainer}>
            <StyledInput
              value={similarToInput}
              onChangeText={setSimilarToInput}
              placeholder="Введите название фильма"
              autoCapitalize="words"
            />
            <Pressable
              onPress={handleSkip}
              style={styles.skipButton}
            >
              <Text style={styles.skipButtonText}>Пропустить</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.optionsContainer}>
            {currentQuestion.options?.map((option) => (
              <Pressable
                key={option}
                onPress={() => handleAnswer(option)}
                style={[
                  styles.optionButton,
                  isSelected(option) && styles.optionButtonSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    isSelected(option) && styles.optionTextSelected,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {currentQuestion.multiple && (
          <Text style={styles.hint}>
            Выбрано:{' '}
            {((answers[currentQuestion.key] as string[]) || []).length} /{' '}
            {currentQuestion.maxSelections}
          </Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleNext}
          disabled={!canProceed()}
          style={[
            styles.nextButton,
            !canProceed() && styles.nextButtonDisabled,
          ]}
        >
          <Text style={styles.nextButtonText}>
            {currentStep === QUIZ_STEPS.length - 1 ? 'Получить рекомендации' : 'Далее'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: theme.spacing.sm,
    marginRight: theme.spacing.md,
  },
  progressContainer: {
    flex: 1,
  },
  progressText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.xs,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: theme.colors.backgroundDark,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flexGrow: 1,
    padding: theme.spacing.lg,
  },
  question: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  optionalText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  inputContainer: {
    marginTop: theme.spacing.md,
  },
  skipButton: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  skipButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    textDecorationLine: 'underline',
  },
  optionsContainer: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  optionButton: {
    backgroundColor: theme.colors.backgroundDark,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  optionButtonSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.backgroundDark,
  },
  optionText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    textAlign: 'center',
  },
  optionTextSelected: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  hint: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  footer: {
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  nextButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    marginTop: theme.spacing.md,
  },
});
