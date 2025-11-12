import { Channel } from '../types';
import { parseXmltvStream, XmltvProgram } from './streamingXmlParser';
import {
  InsertableProgram,
  insertProgramsExclusive,
  ensureEpgDatabase,
  debugDatabaseContents,
} from '../database/epgDatabase';

const HOURS_BEFORE = 12;
const HOURS_AFTER = 36;
const INSERT_THRESHOLD = 40; // Much smaller batches to keep UI responsive
const MAX_QUEUE_SIZE = 120; // Hard limit to prevent large spikes
const MIN_TIME_BETWEEN_FLUSHES = 1000; // Minimum 1 second between flushes

// Memory monitoring helper
const logMemoryUsage = (queue: InsertableProgram[], context: string) => {
  if (__DEV__) {
    console.log(`[EPG Memory] ${context} - Queue size: ${queue.length}`);
  }
};

type ChannelIndexEntry = {
  channel: Channel;
  priority: number;
};

const normalizeKeyVariants = (value: string): string[] => {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }
  const lower = trimmed.toLowerCase();
  const sanitized = lower.replace(/[^a-z0-9]/g, '');
  if (sanitized && sanitized !== lower) {
    return [lower, sanitized];
  }
  return [lower];
};

const buildChannelIndex = (channels: Channel[]): Map<string, ChannelIndexEntry> => {
  const index = new Map<string, ChannelIndexEntry>();

  const register = (key: string | undefined, priority: number, channel: Channel) => {
    if (!key) return;
    normalizeKeyVariants(key).forEach((variant) => {
      const existing = index.get(variant);
      if (!existing || priority < existing.priority) {
        index.set(variant, { channel, priority });
      }
    });
  };

  channels.forEach((channel) => {
    register(channel.tvgId, 1, channel);
    register(channel.id, 2, channel);
    if (!channel.tvgId) {
      register(channel.name, 3, channel);
    }
  });

  return index;
};

const resolveChannel = (
  epgChannelId: string,
  channelIndex: Map<string, ChannelIndexEntry>
): Channel | undefined => {
  for (const variant of normalizeKeyVariants(epgChannelId)) {
    const entry = channelIndex.get(variant);
    if (entry) {
      return entry.channel;
    }
  }
  return undefined;
};

const decodeXmlEntities = (value: string): string =>
  value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#34;/g, '"')
    .replace(/&#38;/g, '&');

const cleanXmlValue = (value?: string): string | undefined => {
  if (!value) return undefined;
  const cleaned = decodeXmlEntities(value).trim();
  return cleaned.length > 0 ? cleaned : undefined;
};

const formatTimezone = (timezone?: string): string => {
  if (!timezone) return 'Z';
  if (timezone === 'Z' || timezone === '+0000' || timezone === '-0000') return 'Z';
  const match = timezone.match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!match) return 'Z';
  const [, sign, hours, minutes] = match;
  return `${sign}${hours}:${minutes}`;
};

const parseXmltvDate = (value?: string): Date | null => {
  if (!value) return null;
  const trimmed = value.trim();
  const compactMatch = trimmed.match(
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s?([+-]\d{4}|[+-]\d{2}:\d{2}|Z))?/
  );
  if (compactMatch) {
    const [, year, month, day, hour, minute, second, timezone] = compactMatch;
    const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}${formatTimezone(timezone)}`;
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const fallback = new Date(trimmed);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }

  // Some providers use ISO strings without separators like 2024-03-21T050000Z or similar.
  const normalized = trimmed
    .replace(/[-:]/g, '')
    .replace(/T/, '')
    .replace(/Z$/, '+0000');

  const normalizedMatch = normalized.match(
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})([+-]\d{4})?$/
  );
  if (normalizedMatch) {
    const [, year, month, day, hour, minute, second, timezone] = normalizedMatch;
    const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}${formatTimezone(timezone)}`;
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
};

const filterProgramWindow = (start: Date, end: Date): boolean => {
  const now = new Date();
  const lowerBound = new Date(now.getTime() - HOURS_BEFORE * 60 * 60 * 1000);
  const upperBound = new Date(now.getTime() + HOURS_AFTER * 60 * 60 * 1000);
  return !(end < lowerBound || start > upperBound);
};

type ConvertResult =
  | { insertable: InsertableProgram; reason?: undefined }
  | { insertable: null; reason: 'no-channel' | 'invalid-dates' | 'outside-window' | 'no-channel-data'; details?: Record<string, unknown> };

const convertProgramToInsert = (
  program: XmltvProgram,
  channelIndex: Map<string, ChannelIndexEntry>,
  playlistId: string
): ConvertResult => {
  const matchedChannel = resolveChannel(program.channel, channelIndex);
  if (!matchedChannel) {
    return { insertable: null, reason: 'no-channel', details: { xmlChannel: program.channel } };
  }

  const startDate = parseXmltvDate(program.start);
  const endDate = parseXmltvDate(program.stop ?? program.start);

  if (!startDate || !endDate) {
    return { insertable: null, reason: 'invalid-dates', details: { start: program.start, stop: program.stop } };
  }

  if (!filterProgramWindow(startDate, endDate)) {
    return { insertable: null, reason: 'outside-window', details: { start: startDate.getTime(), end: endDate.getTime() } };
  }

  return {
    insertable: {
      playlistId,
      channelId: matchedChannel.id,
      title: cleanXmlValue(program.title) ?? 'Untitled',
      description: cleanXmlValue(program.desc),
      start: startDate.getTime(),
      end: endDate.getTime(),
      epgChannelId: program.channel,
    },
  };
};

export const ingestXmltvToDatabase = async ({
  response,
  playlistId,
  channels,
}: {
  response: Response;
  playlistId: string;
  channels: Channel[];
}): Promise<number> => {
  console.log(`[EPG] Starting ingestion for playlist ${playlistId} with ${channels.length} channels`);

  const channelIndex = buildChannelIndex(channels);
  console.log(`[EPG] Built channel index with ${channelIndex.size} entries`);

  const queue: InsertableProgram[] = [];
  let inserted = 0;

  const flushQueue = async (force = false) => {
    if (queue.length === 0) {
      return;
    }

    if (!force && queue.length < INSERT_THRESHOLD) {
      return;
    }

    const batch = queue.splice(0, queue.length);
    logMemoryUsage(queue, `Before flush (batch size: ${batch.length})`);
    console.log(`[EPG] flushing ${batch.length} programs to database`);
    const added = await insertProgramsExclusive(playlistId, batch);
    inserted += added;
    logMemoryUsage(queue, 'After flush');
  };

  let totalProgramsFromXml = 0;
  let programsMatchedToChannels = 0;
  let unmatchedNoChannel = 0;
  let unmatchedInvalidDates = 0;
  let unmatchedOutsideWindow = 0;
  let unmatchedOther = 0;
  const unmatchedSamples: Record<string, number> = {};
  let lastFlushTime = 0;

  await parseXmltvStream(response, {
    onProgram: (program) => {
      totalProgramsFromXml++;
      const result = convertProgramToInsert(program, channelIndex, playlistId);
      if (result.insertable) {
        queue.push(result.insertable);
        programsMatchedToChannels++;
      } else {
        switch (result.reason) {
          case 'no-channel': {
            unmatchedNoChannel++;
            if (result.details?.xmlChannel) {
              const key = String(result.details.xmlChannel);
              if (unmatchedSamples[key] === undefined && Object.keys(unmatchedSamples).length < 5) {
                unmatchedSamples[key] = 1;
              } else if (unmatchedSamples[key] !== undefined) {
                unmatchedSamples[key] += 1;
              }
            }
            break;
          }
          case 'invalid-dates':
            unmatchedInvalidDates++;
            break;
          case 'outside-window':
            unmatchedOutsideWindow++;
            break;
          default:
            unmatchedOther++;
        }
      }
    },
    onChunkProcessed: async () => {
      const now = Date.now();

      // Flush if we have programs and enough time has passed since last flush
      if (queue.length > 0 && (now - lastFlushTime) >= MIN_TIME_BETWEEN_FLUSHES) {
        console.log(`[EPG] chunk processed, flushing ${queue.length} programs`);
        await flushQueue(true);
        lastFlushTime = Date.now();
      } else if (queue.length >= MAX_QUEUE_SIZE) {
        // Emergency flush if queue is critically full, regardless of timing
        console.warn(`[EPG] emergency flush: queue size ${queue.length} >= ${MAX_QUEUE_SIZE}`);
        await flushQueue(true);
        lastFlushTime = Date.now();
      }
    },
  });

  await flushQueue(true);

  console.log(`[EPG] Ingestion summary:
    - Total programs in XML: ${totalProgramsFromXml}
    - Programs matched to channels: ${programsMatchedToChannels}
    - Unmatched (no channel): ${unmatchedNoChannel}
    - Unmatched (invalid dates): ${unmatchedInvalidDates}
    - Unmatched (outside window): ${unmatchedOutsideWindow}
    - Unmatched (other): ${unmatchedOther}`);

  if (Object.keys(unmatchedSamples).length > 0) {
    console.log('[EPG] Sample unmatched channel IDs from XML:', unmatchedSamples);
  }

  try {
    const db = await ensureEpgDatabase();
    const stats = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM epg_programs WHERE playlistId = ?',
      [playlistId]
    );
    console.log(
      '[EPG] inserted',
      inserted,
      'programs for playlist',
      playlistId,
      '- total rows for playlist =',
      stats?.count ?? 0
    );

    // Debug: check database contents
    console.log('[EPG] Checking database contents after ingestion...');
    await debugDatabaseContents(playlistId);

  } catch (logError) {
    console.warn('[EPG] Failed to read epg_programs count:', logError);
  }

  return inserted;
};
