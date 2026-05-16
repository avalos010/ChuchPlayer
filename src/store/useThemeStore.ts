import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, getPreset, buildCustomTheme } from '../theme/themes';

const STORAGE_KEY = '@chuchPlayer:themeState';

interface ThemeState {
  themeId: string;
  customAccent: string;
  customBg: string;
  theme: Theme;

  setTheme: (id: string) => void;
  setCustom: (bg: string, accent: string) => void;
  resetTheme: () => void;
  loadPersistedTheme: () => Promise<void>;
}

const DEFAULT_ID = 'dark';

function persist(state: { themeId: string; customAccent: string; customBg: string }) {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeId: DEFAULT_ID,
  customAccent: '#ffffff',
  customBg: '#0a0a0a',
  theme: getPreset(DEFAULT_ID),

  setTheme: (id) => {
    const theme = id === 'custom'
      ? buildCustomTheme('#0a0a0a', '#ffffff')
      : getPreset(id);
    set({ themeId: id, theme });
    persist({ themeId: id, customAccent: '#ffffff', customBg: '#0a0a0a' });
  },

  setCustom: (bg, accent) => {
    const theme = buildCustomTheme(bg, accent);
    set({ themeId: 'custom', customBg: bg, customAccent: accent, theme });
    persist({ themeId: 'custom', customBg: bg, customAccent: accent });
  },

  resetTheme: () => {
    const theme = getPreset(DEFAULT_ID);
    set({ themeId: DEFAULT_ID, customAccent: '#ffffff', customBg: '#0a0a0a', theme });
    persist({ themeId: DEFAULT_ID, customAccent: '#ffffff', customBg: '#0a0a0a' });
  },

  loadPersistedTheme: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { themeId: string; customAccent: string; customBg: string };
      const theme = saved.themeId === 'custom'
        ? buildCustomTheme(saved.customBg ?? '#0a0a0a', saved.customAccent ?? '#ffffff')
        : getPreset(saved.themeId);
      set({ ...saved, theme });
    } catch {}
  },
}));
