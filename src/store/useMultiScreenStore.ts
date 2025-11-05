import { create } from 'zustand';
import { Channel } from '../types';

export interface MultiScreen {
  id: string;
  channel: Channel;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  isFocused: boolean;
}

interface MultiScreenState {
  screens: MultiScreen[];
  isMultiScreenMode: boolean;
  maxScreens: number;
  layout: 'grid' | 'split'; // grid = 2x2, split = side-by-side
  setMaxScreens: (max: number) => void;
  
  // Actions
  addScreen: (channel: Channel) => void;
  removeScreen: (screenId: string) => void;
  updateScreen: (screenId: string, updates: Partial<MultiScreen>) => void;
  setFocusedScreen: (screenId: string) => void;
  toggleMultiScreenMode: () => void;
  setLayout: (layout: 'grid' | 'split') => void;
  clearAllScreens: () => void;
  setMaxScreens: (max: number) => void;
  
  // Helpers
  getFocusedScreen: () => MultiScreen | null;
  getScreenCount: () => number;
  canAddScreen: () => boolean;
}

export const useMultiScreenStore = create<MultiScreenState>((set, get) => ({
  screens: [],
  isMultiScreenMode: false,
  maxScreens: 4,
  layout: 'grid',
  
  addScreen: (channel) => {
    const state = get();
    if (state.screens.length >= state.maxScreens) {
      return; // Cannot add more screens
    }
    
    // Check if channel already exists in screens
    if (state.screens.some(s => s.channel.id === channel.id)) {
      return; // Channel already added
    }
    
    const newScreen: MultiScreen = {
      id: `screen-${Date.now()}-${Math.random()}`,
      channel,
      isPlaying: true,
      volume: 1.0,
      isMuted: false,
      isFocused: state.screens.length === 0, // First screen is focused by default
    };
    
    // Unfocus all other screens
    const updatedScreens = state.screens.map(s => ({ ...s, isFocused: false }));
    
    set({
      screens: [...updatedScreens, newScreen],
      isMultiScreenMode: true,
    });
  },
  
  removeScreen: (screenId) => {
    const state = get();
    const remainingScreens = state.screens.filter(s => s.id !== screenId);
    
    // If removing the focused screen, focus the first remaining screen
    if (remainingScreens.length > 0 && state.screens.find(s => s.id === screenId)?.isFocused) {
      remainingScreens[0].isFocused = true;
    }
    
    set({
      screens: remainingScreens,
      isMultiScreenMode: remainingScreens.length > 1,
    });
  },
  
  updateScreen: (screenId, updates) => {
    set((state) => ({
      screens: state.screens.map(s =>
        s.id === screenId ? { ...s, ...updates } : s
      ),
    }));
  },
  
  setFocusedScreen: (screenId) => {
    set((state) => ({
      screens: state.screens.map(s => ({
        ...s,
        isFocused: s.id === screenId,
      })),
    }));
  },
  
  toggleMultiScreenMode: () => {
    set((state) => ({
      isMultiScreenMode: !state.isMultiScreenMode,
    }));
  },
  
  setLayout: (layout) => {
    set({ layout });
  },
  
  clearAllScreens: () => {
    set({
      screens: [],
      isMultiScreenMode: false,
    });
  },
  
  setMaxScreens: (max) => {
    set({ maxScreens: max });
    // Remove screens if they exceed the new max
    const state = get();
    if (state.screens.length > max) {
      set({
        screens: state.screens.slice(0, max),
      });
    }
  },
  
  getFocusedScreen: () => {
    return get().screens.find(s => s.isFocused) || null;
  },
  
  getScreenCount: () => {
    return get().screens.length;
  },
  
  canAddScreen: () => {
    const state = get();
    return state.screens.length < state.maxScreens;
  },
}));

