import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { Channel } from '../types';

const { EpgIngestionModule } = NativeModules;

interface EpgIngestionModuleInterface {
  startIngestion(
    epgUrl: string,
    playlistId: string,
    channelsJson: string,
    datasetSignature: string | null
  ): Promise<number>; // Returns count of inserted programs
}

const eventEmitter = new NativeEventEmitter(
  Platform.OS === 'android' ? EpgIngestionModule : null
);

export type IngestionProgress = {
  programsProcessed: number;
  epgUrl?: string;
};

export type IngestionEventType = 'progress' | 'complete' | 'error';

export type IngestionEventListener = (
  type: IngestionEventType,
  data: IngestionProgress | { programsCount: number; epgUrl?: string } | { error: string; epgUrl?: string }
) => void;

export const startNativeEpgIngestion = async (
  epgUrl: string,
  playlistId: string,
  channels: Channel[],
  datasetSignature?: string,
  onEvent?: IngestionEventListener
): Promise<number> => {
  if (!EpgIngestionModule) {
    throw new Error('EpgIngestionModule is not available');
  }

  // Clean up existing listeners
  eventEmitter.removeAllListeners('EPG_INGESTION_PROGRESS');
  eventEmitter.removeAllListeners('EPG_INGESTION_COMPLETE');
  eventEmitter.removeAllListeners('EPG_INGESTION_ERROR');

  // Set up event listeners
  if (onEvent) {
    eventEmitter.addListener('EPG_INGESTION_PROGRESS', (data: IngestionProgress) => {
      onEvent('progress', data);
    });

    eventEmitter.addListener('EPG_INGESTION_COMPLETE', (data: { programsCount: number; epgUrl?: string }) => {
      onEvent('complete', data);
    });

    eventEmitter.addListener('EPG_INGESTION_ERROR', (data: { error: string; epgUrl?: string }) => {
      onEvent('error', data);
    });
  }

  const channelsJson = JSON.stringify(
    channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      tvgId: ch.tvgId,
    }))
  );

  try {
    // Kotlin module handles everything: parsing, matching, and writing to Realm
    // All happens in background thread - no JS thread blocking!
    const inserted = await (EpgIngestionModule as EpgIngestionModuleInterface).startIngestion(
      epgUrl,
      playlistId,
      channelsJson,
      datasetSignature || null
    );

    return inserted;
  } finally {
    // Clean up listeners
    eventEmitter.removeAllListeners('EPG_INGESTION_PROGRESS');
    eventEmitter.removeAllListeners('EPG_INGESTION_COMPLETE');
    eventEmitter.removeAllListeners('EPG_INGESTION_ERROR');
  }
};

export const isNativeIngestionAvailable = (): boolean => {
  return Platform.OS === 'android' && EpgIngestionModule != null;
};

