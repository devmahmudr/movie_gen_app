import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { recommendationsAPI } from '../services/apiClient';
import { useLanguageStore } from '../store/languageStore';
import { theme } from '../constants/theme';
import { StyledInput } from '../components/StyledInput';
import { useAuthStore } from '../store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAlert } from '../hooks/useAlert';

interface QuizAnswers {
  context?: string;
  moods: string[];
  tags: string[];
  similarTo?: string;
  format?: string;
}

const moodToTagsMap: { [key: string]: string[] } = {
  // 1. РАССЛАБИТЬСЯ
  Расслабиться: [
    '🌿 Природная атмосфера — леса, море, закаты, спокойствие',
    '🏡 Уютный маленький город — ламповые беседы, тихая жизнь',
    '🍵 Тёплая повседневность — еда, хобби, уютный ритм',
    '🌤 Мягкая романтика — лёгкие эмоции, без драмы',
    '✈️ Путешествие без спешки — красивые кадры и спокойствие',
  ],
  // 2. АДРЕНАЛИН
  Адреналин: [
    '🔫 Криминальный мир — банды, мафия, опасные дела',
    '💣 Война и спецоперации — героизм, риск, напряжение',
    '🏃 Побег или погоня — скорость, опасность, драйв',
    '🥋 Боевые искусства — стильные драки, дисциплина',
    '🌪 Выживание на пределе — стихии, борьба за жизнь',
    '☣️ Пост-апокалипсис — мир после катастрофы, хаос',
  ],
  // 3. ПОСМЕЯТЬСЯ
  Посмеяться: [
    '😂 Ситуационная комедия — нелепости, угар',
    '💘 Романтические приколы — свидания, флирт',
    '🧑‍🤝‍🧑 Дружеская движуха — бардак компании',
    '🚗 Дорожные приколы — приключения в пути',
    '🎭 Сатира и стёб — смех над реальностью',
  ],
  // 4. УДИВИТЬСЯ
  Удивиться: [
    '🌀 Неожиданный финал — поворот-шок',
    '🔮 Альтернативная реальность — другой мир, другие правила',
    '🔁 Временная петля — цикл, ломка сознания',
    '✨ Магия среди нас — необычное в обычном',
    '🚀 Удивительное будущее — технологии и мир будущего',
  ],
  // 5. УЮТ / ТЕПЛО
  'Почувствовать уют / тепло': [
    '🕯 Тёплая семейная история — отношения и любовь',
    '🎄 Зимняя атмосфера — огоньки, праздник, уют',
    '💛 Добрая романтика — мягкие чувства',
    '📚 Ностальгия по детству — воспоминания, тепло',
    '🧁 Терапевтичный уют — спокойствие и комфорт',
  ],
  // 6. ПОГРУЗИТЬСЯ В АТМОСФЕРУ
  'Погрузиться в атмосферу': [
    '🌌 Атмосферный космос — красота Вселенной',
    '🌫 Мрачный нуар — дождь, тени, детективность',
    '🏛 Мир древних легенд — мифы и ритуалы',
    '🎨 Визуальная эстетика — кино как искусство',
    '🐾 Природная магия — туман, духи, лес',
    '👽 Пришельцы (атмосферно) — загадка, неизвестность',
  ],
  // 7. ЧУТЬ ПОПЕРЕЖИВАТЬ
  'Чуть попереживать': [
    '🔍 Лёгкое расследование — загадка, интрига',
    '❤️‍🩹 Сложные отношения — чувства, выбор',
    '🧩 Психологические загадки — непростые персонажи',
    '❄️ Тихая драма — спокойная, но цепляющая',
    '🕰 История о судьбе — размышления и смысл',
  ],
  // 8. НЕМНОГО ПОПУГАТЬСЯ
  'Немного попугаться': [
    '👁 Мистика — тени, странности',
    '👻 Паранормальные явления — дом, где «что-то есть»',
    '🌑 Тревожная атмосфера — холодок по спине',
    '🌲 Жуткие места — лес, заброшки, туннели',
    '🧠 Психологический триллер — игра разума',
    '👽 Пришельцы (страшные) — вторжение, страх неизвестного',
  ],
  // 9. ГЛУБОКИЕ ЭМОЦИИ
  'Глубокие эмоции': [
    '💔 Сильная жизненная история — судьбы, которые ломают',
    '🌙 Глубокий смысл — философия, размышления',
    '🎭 Мощная эмоция — катарсис, очищение',
    '🛤 Путь героя через боль — падение и подъём',
    '📖 Реальные события — история, которая была',
  ],
  // 10. ПРИКЛЮЧЕНИЕ
  'Чувство приключения': [
    '🗺 Поиск артефактов — карты, ловушки',
    '👑 Эпическое фэнтези — короли, магия, миры',
    '🚀 Космические приключения — галактики и битвы',
    '🛡 Геройское становление — путь персонажа',
    '🧭 Экспедиции — неизведанные территории',
    '👽 Инопланетные миры — цивилизации и планеты',
  ],
  // 11. ТАЙНА
  'Ощутить тайну': [
    '🔍 Расследование — улики, подозрения',
    '🕵 Секретные организации — заговоры',
    '🕳 Тёмная загадочность — символы и странности',
    '📜 Загадки прошлого — тайны истории',
    '🎭 Двойные игры — манипуляции и ложь',
  ],
  // 12. ВДОХНОВЕНИЕ
  Вдохновиться: [
    '🥇 История успеха — цель, путь',
    '🎨 Творческий поиск — искусство и смысл',
    '🤝 Преодоление трудностей — сила характера',
    '🚴 Спортивные достижения — борьба за рекорды',
    '🌄 Духовный рост — путь к себе',
  ],
};

const QUIZ_STEPS = [
  {
    question: 'С кем ты сегодня смотришь?',
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
    question: 'Какое ощущение ты хочешь получить?',
    options: [
      'Расслабиться',
      'Адреналин',
      'Посмеяться',
      'Удивиться',
      'Почувствовать уют / тепло',
      'Погрузиться в атмосферу',
      'Чуть попереживать',
      'Немного попугаться',
      'Глубокие эмоции',
      'Чувство приключения',
      'Ощутить тайну',
      'Вдохновиться',
    ],
    key: 'moods' as keyof QuizAnswers,
    multiple: true,
    maxSelections: 2,
  },
  {
    question: 'Атмосферные сюжетные мотивы',
    options: [], // Will be populated dynamically based on Question 2
    key: 'tags' as keyof QuizAnswers,
    multiple: true,
    maxSelections: 2,
  },
  {
    question: 'Хочешь уточнить детали фильма? (опционально)',
    key: 'similarTo' as keyof QuizAnswers,
    optional: true,
    input: true, // This is an input field
  },
  {
    question: 'Хочешь фильм, сериал или мультфильм варианта?',
    options: ['Фильм', 'Сериал', 'Мультфильм', 'Не важно'],
    key: 'format' as keyof QuizAnswers,
  },
];

const QUIZ_STATE_KEY = 'pending_quiz_state';

export default function QuizScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const segments = useSegments();
  const { token } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { showAlert, AlertComponent } = useAlert();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({
    moods: [],
    tags: [],
  });
  const [loading, setLoading] = useState(false);
  const [similarToInput, setSimilarToInput] = useState('');
  const [customTagInput, setCustomTagInput] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const customTagInputRef = useRef<View>(null);
  const previousSegmentRef = useRef<string | null>(null);

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

  // Reset loading state when component mounts or when navigating back from results
  useEffect(() => {
    // Reset loading state on mount
    setLoading(false);
  }, []);

  // Monitor segment changes to detect navigation back from results
  useEffect(() => {
    const currentSegment = segments[0] || '';
    const previousSegment = previousSegmentRef.current;
    
    // If we're on quiz screen and were previously on results, reset loading
    if (currentSegment === 'quiz' && previousSegment === 'results') {
      setLoading(false);
    }
    
    previousSegmentRef.current = currentSegment;
  }, [segments]);

  const getAvailableTags = () => {
    if (answers.moods.length === 0) {
      return [];
    }
    // Combine tags from all selected moods
    const availableTags = answers.moods.flatMap((mood) => moodToTagsMap[mood] || []);
    const uniqueTags = [...new Set(availableTags)];
    
    // Add custom tags that are not in the predefined list
    const customTags = answers.tags.filter(tag => 
      !uniqueTags.includes(tag)
    );
    
    return [...uniqueTags, ...customTags];
  };

  const currentQuestion = QUIZ_STEPS[currentStep];
  const progress = ((currentStep + 1) / QUIZ_STEPS.length) * 100;

  const handleBack = () => {
    // Reset loading state when navigating back
    setLoading(false);
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      router.back();
    }
  };

  const handleAnswer = (option: string) => {
    const isMoodQuestion = currentQuestion.key === 'moods';

    if (currentQuestion.multiple) {
      const currentAnswers = (answers[currentQuestion.key] as string[]) || [];
      const isSelected = currentAnswers.includes(option);
      let newAnswersList;

      if (isSelected) {
        // Deselect
        newAnswersList = currentAnswers.filter((a) => a !== option);
      } else {
        // Select (if under max)
        if (
          currentAnswers.length < (currentQuestion.maxSelections || 2)
        ) {
          newAnswersList = [...currentAnswers, option];
        } else {
          newAnswersList = currentAnswers;
        }
      }
      
      if (isMoodQuestion) {
        // If moods change, reset tags but keep custom tags
        const availableTags = newAnswersList.flatMap(mood => moodToTagsMap[mood] || []);
        // Keep tags that are either in available tags or are custom (not in any mood's tag list)
        const allMoodTags = Object.values(moodToTagsMap).flat();
        const filteredTags = answers.tags.filter(tag => 
          availableTags.includes(tag) || !allMoodTags.includes(tag)
        );
        setAnswers({
          ...answers,
          [currentQuestion.key]: newAnswersList,
          tags: filteredTags,
        });
      } else {
         setAnswers({ ...answers, [currentQuestion.key]: newAnswersList });
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
    // Save input value for similarTo question (4th question)
    // IMPORTANT: Save even if empty string to ensure it's tracked
    if (currentQuestion.input) {
      const trimmedValue = similarToInput.trim();
      setAnswers({ ...answers, [currentQuestion.key]: trimmedValue || undefined });
      console.log('Saved similarTo (4th question):', trimmedValue || '(empty/skipped)');
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
      // Redirect to login with a message parameter
      router.push({
        pathname: '/(auth)/login',
        params: { 
          fromQuiz: 'true',
          message: 'Для получения рекомендаций необходимо войти в систему'
        }
      });
      return;
    }

    // Show loading screen on Quiz screen before making API call
    setLoading(true);
    try {
      // Get language preference
      const language = useLanguageStore.getState().language;
      const languageCode = language === 'ru' ? 'ru-RU' : 'en-US';
      
      // CRITICAL: Ensure similarTo (4th question) is captured - check both answers state and input state
      // This handles the case where user typed something but didn't click Next (just clicked Submit)
      const similarToValue = answers.similarTo || (similarToInput && similarToInput.trim() ? similarToInput.trim() : undefined);
      
      console.log('Submitting quiz with ALL 5 answers:', {
        '1. Context': answers.context || 'Один',
        '2. Moods': answers.moods,
        '3. Tags': answers.tags,
        '4. Similar To': similarToValue || '(not provided - user skipped)',
        '5. Format': answers.format || 'Не важно',
      });

      const response = await recommendationsAPI.getRecommendations({
        context: answers.context || 'Один',
        moods: answers.moods,
        tags: answers.tags,
        similarTo: similarToValue, // This is the 4th question - MUST be included if provided
        format: answers.format || 'Не важно',
        language: languageCode,
      });

      console.log('Recommendations received:', response);
      
      if (!response || !Array.isArray(response)) {
        throw new Error('Invalid response format');
      }
      
      // Accept partial results (1-2 movies) instead of failing completely
      if (response.length === 0) {
        throw new Error('No recommendations received');
      }

      // Navigate only after API call is complete
      router.push({
        pathname: '/results',
        params: { 
          movies: JSON.stringify(response),
          quizAnswers: JSON.stringify({
            context: answers.context || 'Один',
            moods: answers.moods,
            tags: answers.tags,
            similarTo: answers.similarTo,
            format: answers.format || 'Не важно',
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
      
      // More specific error messages
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = 'Запрос занял слишком много времени. Попробуйте снова.';
      } else if (error.message?.includes('Network Error') || error.code === 'ECONNREFUSED') {
        errorMessage = 'Ошибка подключения к серверу. Проверьте подключение к интернету.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Не удалось найти фильмы по вашим критериям. Попробуйте изменить предпочтения.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Ошибка сервера. Попробуйте через несколько секунд.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Сессия истекла. Пожалуйста, войдите снова.';
        // Redirect to login
        router.push('/(auth)/login');
        return;
      }
      
      showAlert({
        message: errorMessage,
        type: 'error',
      });
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
      <ScrollView
          ref={scrollViewRef}
        contentContainerStyle={[styles.content, { paddingBottom: 80 }]}
        showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
      >
        <Text style={styles.question}>{currentQuestion.question}</Text>
        {currentQuestion.optional && !currentQuestion.input && (
          <Text style={styles.optionalText}>(необязательно)</Text>
        )}
        {currentQuestion.key === 'tags' && answers.moods.length > 0 && (
          <Text style={styles.hint}>
            Варианты основаны на выбранных ощущениях: {answers.moods.join(', ')}
          </Text>
        )}

        {currentQuestion.input ? (
          <View style={styles.inputContainer}>
            <StyledInput
              value={similarToInput}
              onChangeText={setSimilarToInput}
              placeholder="Хочу как Криминальный город, криминальная комедия Южной Кореи"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              autoCapitalize="words"
              multiline={true}
              numberOfLines={2}
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
            {(currentQuestion.key === 'tags' ? getAvailableTags() : currentQuestion.options)?.map((option) => (
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
            
            {/* Custom tag input for Question 3 */}
            {currentQuestion.key === 'tags' && (
              <View 
                ref={customTagInputRef}
                style={styles.customTagContainer}
              >
                <Text style={styles.customTagLabel}>Или добавьте свой вариант:</Text>
                <View style={styles.customTagInputRow}>
                  <View style={styles.customTagInputWrapper}>
                    <StyledInput
                      value={customTagInput}
                      onChangeText={setCustomTagInput}
                      placeholder="Введите свой тег..."
                      autoCapitalize="words"
                      onFocus={() => {
                        // Scroll to bottom when input is focused to show it above keyboard
                        setTimeout(() => {
                          scrollViewRef.current?.scrollToEnd({ animated: true });
                        }, 100);
                      }}
                    />
                  </View>
                  <Pressable
                    onPress={() => {
                      if (customTagInput.trim() && 
                          (answers.tags.length < (currentQuestion.maxSelections || 2))) {
                        const customTag = customTagInput.trim();
                        const currentTags = answers.tags || [];
                        if (!currentTags.includes(customTag)) {
                          setAnswers({
                            ...answers,
                            tags: [...currentTags, customTag],
                          });
                          setCustomTagInput('');
                        }
                      }
                    }}
                    disabled={
                      !customTagInput.trim() || 
                      (answers.tags.length >= (currentQuestion.maxSelections || 2))
                    }
                    style={[
                      styles.addCustomTagButton,
                      (!customTagInput.trim() || 
                       answers.tags.length >= (currentQuestion.maxSelections || 2)) && 
                      styles.addCustomTagButtonDisabled
                    ]}
                  >
                    <Ionicons 
                      name="add" 
                      size={20} 
                      color={
                        (!customTagInput.trim() || 
                         answers.tags.length >= (currentQuestion.maxSelections || 2))
                          ? theme.colors.textSecondary 
                          : theme.colors.primary
                      } 
                    />
                  </Pressable>
                </View>
              </View>
            )}
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
      </KeyboardAvoidingView>

      <View style={[styles.footer, { 
        paddingBottom: Math.max(insets.bottom, 8) + 80 // Navbar height (~60px) + safe area + extra space
      }]}>
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
      <AlertComponent />
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
    paddingBottom: theme.spacing.xxl,
  },
  keyboardAvoidingView: {
    flex: 1,
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
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    // paddingBottom is set dynamically to account for navbar height and safe area
  },
  nextButton: {
    backgroundColor: theme.colors.primarySoft,
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
  customTagContainer: {
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  customTagLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.sm,
  },
  customTagInputRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  customTagInputWrapper: {
    flex: 1,
  },
  addCustomTagButton: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.backgroundDark,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCustomTagButtonDisabled: {
    borderColor: theme.colors.border,
    opacity: 0.5,
  },
});
