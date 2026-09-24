import { Settings } from '../../types';
import { DEFAULT_SETTINGS } from '../../utils/storage';

export interface InterfacePreferences {
  infoBarTimeoutSeconds: number;
  showChannelNumbers: boolean;
  clockFormat: '12h' | '24h';
}

export const DEFAULT_INTERFACE_PREFERENCES: InterfacePreferences = {
  infoBarTimeoutSeconds: DEFAULT_SETTINGS.infoBarTimeoutSeconds ?? 6,
  showChannelNumbers: DEFAULT_SETTINGS.showChannelNumbers ?? false,
  clockFormat: DEFAULT_SETTINGS.clockFormat ?? '24h',
};

export const getInterfacePreferencesFromSettings = (
  settings?: Partial<Settings> | null,
): InterfacePreferences => ({
  infoBarTimeoutSeconds:
    settings?.infoBarTimeoutSeconds ??
    DEFAULT_INTERFACE_PREFERENCES.infoBarTimeoutSeconds,
  showChannelNumbers:
    settings?.showChannelNumbers ??
    DEFAULT_INTERFACE_PREFERENCES.showChannelNumbers,
  clockFormat:
    settings?.clockFormat ?? DEFAULT_INTERFACE_PREFERENCES.clockFormat,
});
