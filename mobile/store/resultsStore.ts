import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ResultsNavigation {
  pathname: string;
  params?: Record<string, string>;
}

interface ResultsState {
  hasResults: boolean;
  resultsNavigation: ResultsNavigation | null;
  lastNavigatedFromResults: string | null; // Track which page was navigated to from results
  setHasResults: (hasResults: boolean, navigation?: ResultsNavigation | null) => Promise<void>;
  setLastNavigatedFromResults: (route: string | null) => void;
  clearResults: () => Promise<void>;
}

const RESULTS_KEY = 'has_results';
const RESULTS_NAV_KEY = 'results_navigation';
const LAST_NAV_KEY = 'last_navigated_from_results';

export const useResultsStore = create<ResultsState>((set) => ({
  hasResults: false,
  resultsNavigation: null,
  lastNavigatedFromResults: null,
  
  setHasResults: async (hasResults: boolean, navigation: ResultsNavigation | null = null) => {
    set({ hasResults, resultsNavigation: navigation });
    if (hasResults && navigation) {
      await AsyncStorage.setItem(RESULTS_KEY, 'true');
      await AsyncStorage.setItem(RESULTS_NAV_KEY, JSON.stringify(navigation));
    } else {
      await AsyncStorage.removeItem(RESULTS_KEY);
      await AsyncStorage.removeItem(RESULTS_NAV_KEY);
    }
  },
  
  setLastNavigatedFromResults: (route: string | null) => {
    set({ lastNavigatedFromResults: route });
    if (route) {
      AsyncStorage.setItem(LAST_NAV_KEY, route);
    } else {
      AsyncStorage.removeItem(LAST_NAV_KEY);
    }
  },
  
  clearResults: async () => {
    set({ hasResults: false, resultsNavigation: null, lastNavigatedFromResults: null });
    await AsyncStorage.removeItem(RESULTS_KEY);
    await AsyncStorage.removeItem(RESULTS_NAV_KEY);
    await AsyncStorage.removeItem(LAST_NAV_KEY);
  },
}));

// Load initial state from AsyncStorage
AsyncStorage.getItem(RESULTS_KEY).then((hasResults) => {
  if (hasResults === 'true') {
    Promise.all([
      AsyncStorage.getItem(RESULTS_NAV_KEY),
      AsyncStorage.getItem(LAST_NAV_KEY),
    ]).then(([navStr, lastNav]) => {
      const state: any = { hasResults: true };
      if (navStr) {
        try {
          state.resultsNavigation = JSON.parse(navStr);
        } catch (e) {
          console.error('Error parsing results navigation:', e);
        }
      }
      if (lastNav) {
        state.lastNavigatedFromResults = lastNav;
      }
      useResultsStore.setState(state);
    });
  }
});

