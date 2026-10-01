import { Channel } from '../../types';
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
  onProgress?: () => void;
}

const getGuideErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  if (/HTTP (401|403)\b/i.test(message)) {
    return 'The guide provider rejected your login. Check your playlist credentials or subscription, then refresh the guide.';
  }
  if (/HTTP 404\b/i.test(message)) {
    return 'The guide URL was not found on your provider. Check the EPG URL in playlist settings, then refresh the guide.';
  }
  if (/HTTP 429\b/i.test(message)) {
    return 'The guide provider is receiving too many requests. Wait a few minutes, then refresh the guide.';
  }
  if (/timed?\s*out|timeout/i.test(message)) {
    return 'The guide took too long to download or process. Existing listings may still be available. Try refreshing the guide.';
  }
  if (/XML|pullparser|unexpected token|invalid.*(document|content)|gzip/i.test(message)) {
    return 'The guide provider returned an unreadable XMLTV file. Check the EPG URL in playlist settings, then refresh the guide.';
  }
  return 'The guide could not be downloaded. Your channels can still play. Check your connection and EPG URL, then refresh the guide.';
};

export const ingestEpgData = async ({
  playlistId,
  channels,
  datasetSignature,
  urlsToIngest,
  onProgress,
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
        const message = getGuideErrorMessage(error);
        console.warn(`[EPG] Source ${i + 1}: ${message}`);
        errors.push(message);
      }
    }
    return errors;
  }

  for (let i = 0; i < urlsToIngest.length; i++) {
    const epgUrl = urlsToIngest[i];
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 2000));

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let lastProgressCount = 0;
    try {
      const ingestionTimeoutMs = 5 * 60 * 1000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        timeoutId = setTimeout(
          () => reject(new Error('EPG ingestion timed out after 5 minutes')),
          ingestionTimeoutMs,
        ),
      );
      const onEvent: IngestionEventListener = (type, data) => {
        if (type === 'progress') {
          const progress = data as IngestionProgress;
          if (progress.programsProcessed > lastProgressCount) {
            lastProgressCount = progress.programsProcessed;
            onProgress?.();
          }
          console.log(
            `[EPG] Source ${i + 1}: ${progress.programsProcessed} processed`,
          );
        } else if (type === 'complete') {
          const complete = data as {
            programsCount: number;
            epgUrl?: string;
          };
          console.log(
            `[EPG] Source ${i + 1}: ${complete.programsCount} inserted`,
          );
        } else if (type === 'error') {
          const error = data as { error: string; epgUrl?: string };
          console.warn(`[EPG] Source ${i + 1}: ${getGuideErrorMessage(new Error(error.error))}`);
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
      errors.push(getGuideErrorMessage(error));
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
  }

  return errors;
};
