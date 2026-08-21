import { EPGProgram, Channel } from '../../types';
import { ingestXmltvToDatabase } from '../../utils/epgParser';
import { getXtreamProxyUrl } from '../../utils/xtreamProxy';
import {
  isNativeIngestionAvailable,
  startNativeEpgIngestion,
  IngestionEventListener,
  IngestionProgress,
} from '../../services/nativeEpgIngestion';

interface IngestEpgDataArgs {
  playlistId: string;
  channels: Channel[];
  datasetSignature: string;
  urlsToIngest: string[];
}

export const ingestEpgData = async ({
  playlistId,
  channels,
  datasetSignature,
  urlsToIngest,
}: IngestEpgDataArgs) => {
  const errors: string[] = [];

  if (!isNativeIngestionAvailable()) {
    for (let i = 0; i < urlsToIngest.length; i++) {
      const epgUrl = urlsToIngest[i];
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        const response = await fetch(getXtreamProxyUrl(epgUrl));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await ingestXmltvToDatabase({ response, playlistId, channels });
      } catch (error) {
        errors.push(
          `${epgUrl} - ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
    return errors;
  }

  for (let i = 0; i < urlsToIngest.length; i++) {
    const epgUrl = urlsToIngest[i];
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const ingestionTimeoutMs = 5 * 60 * 1000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('EPG ingestion timed out after 5 minutes')),
          ingestionTimeoutMs,
        ),
      );
      const onEvent: IngestionEventListener = (type, data) => {
        const getUrlShort = (url?: string) => {
          if (!url || typeof url !== 'string') return 'unknown';
          const parts = url.split('/');
          return parts[parts.length - 1] || url;
        };

        if (type === 'progress') {
          const progress = data as IngestionProgress;
          console.log(
            `[EPG] ${getUrlShort(progress.epgUrl)}: ${progress.programsProcessed} processed`,
          );
        } else if (type === 'complete') {
          const complete = data as {
            programsCount: number;
            epgUrl?: string;
          };
          console.log(
            `[EPG] ${getUrlShort(complete.epgUrl)}: ${complete.programsCount} inserted`,
          );
        } else if (type === 'error') {
          const error = data as { error: string; epgUrl?: string };
          console.error(`[EPG] ${getUrlShort(error.epgUrl)}: ${error.error}`);
        }
      };

      await Promise.race([
        startNativeEpgIngestion(
          epgUrl,
          playlistId,
          channels,
          datasetSignature,
          onEvent,
        ),
        timeoutPromise,
      ]);
    } catch (error) {
      errors.push(`${epgUrl} - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return errors;
};
