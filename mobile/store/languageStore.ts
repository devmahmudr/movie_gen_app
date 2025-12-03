import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Language = 'ru' | 'en'; // Add more languages later

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
  loadLanguage: () => Promise<void>;
}

const LANGUAGE_KEY = 'app_language';
const DEFAULT_LANGUAGE: Language = 'ru';

export const useLanguageStore = create<LanguageState>((set) => ({
  language: DEFAULT_LANGUAGE,
  isLoading: false,

  setLanguage: async (language: Language) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, language);
      set({ language });
    } catch (error) {
      console.error('Error saving language:', error);
    }
  },

  loadLanguage: async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (savedLanguage && (savedLanguage === 'ru' || savedLanguage === 'en')) {
        set({ language: savedLanguage as Language });
      } else {
        // Default to Russian
        set({ language: DEFAULT_LANGUAGE });
        await AsyncStorage.setItem(LANGUAGE_KEY, DEFAULT_LANGUAGE);
      }
    } catch (error) {
      console.error('Error loading language:', error);
      set({ language: DEFAULT_LANGUAGE });
    }
  },
}));

