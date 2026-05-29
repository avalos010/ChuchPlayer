import { Platform } from 'react-native';
import { EPGProgram } from '../../types';
import { E2E_PROGRAMS_STORAGE_KEY } from './constants';

export type ProgramsByChannel = Record<string, EPGProgram[]>;

const isE2EWeb = Platform.OS === 'web' && process.env.EXPO_PUBLIC_E2E === '1';

export const loadE2EPrograms = (): ProgramsByChannel | null => {
  if (!isE2EWeb || typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(E2E_PROGRAMS_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<
      string,
      Array<
        Omit<EPGProgram, 'start' | 'end'> & {
          start: string;
          end: string;
        }
      >
    >;

    return Object.entries(parsed).reduce<ProgramsByChannel>(
      (acc, [channelId, programs]) => {
        acc[channelId] = programs.map((program) => ({
          ...program,
          start: new Date(program.start),
          end: new Date(program.end),
        }));
        return acc;
      },
      {},
    );
  } catch (error) {
    console.warn('[EPG] Failed to load E2E programs', error);
    return null;
  }
};

export const isE2EWebMode = () => isE2EWeb;
