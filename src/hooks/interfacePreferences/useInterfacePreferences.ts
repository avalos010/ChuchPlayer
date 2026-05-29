import { useEffect } from 'react';
import { create } from 'zustand';
import { getSettings } from '../../utils/storage';
import {
  DEFAULT_INTERFACE_PREFERENCES,
  getInterfacePreferencesFromSettings,
  InterfacePreferences,
} from './shared';

interface InterfacePreferencesState {
  hydrated: boolean;
  preferences: InterfacePreferences;
  setPreferences: (preferences: InterfacePreferences) => void;
}

const useInterfacePreferencesStore = create<InterfacePreferencesState>((set) => ({
  hydrated: false,
  preferences: DEFAULT_INTERFACE_PREFERENCES,
  setPreferences: (preferences) =>
    set({
      hydrated: true,
      preferences,
    }),
}));

export const syncInterfacePreferences = (
  settings?: Partial<{
    showEPG: boolean;
    infoBarTimeoutSeconds: number;
    showChannelNumbers: boolean;
    clockFormat: '12h' | '24h';
  }> | null,
) => {
  useInterfacePreferencesStore
    .getState()
    .setPreferences(getInterfacePreferencesFromSettings(settings));
};

export const loadInterfacePreferences = async () => {
  const settings = await getSettings();
  syncInterfacePreferences(settings);
  return useInterfacePreferencesStore.getState().preferences;
};

export const useInterfacePreferences = () => {
  const hydrated = useInterfacePreferencesStore((state) => state.hydrated);
  const preferences = useInterfacePreferencesStore(
    (state) => state.preferences,
  );

  useEffect(() => {
    if (hydrated) return;
    loadInterfacePreferences().catch(() => undefined);
  }, [hydrated]);

  return preferences;
};
