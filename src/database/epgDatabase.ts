import Realm from 'realm';
import { EPGProgram } from '../types';

export type InsertableProgram = {
  playlistId: string;
  channelId: string;
  title: string;
  description?: string;
  start: number;
  end: number;
  epgChannelId?: string;
};

export type MetadataRow = {
  playlistId: string;
  lastUpdated: number;
  sourceSignature?: string | null;
};

type ProgramObject = Realm.Object & {
  id: string;
  playlistId: string;
  channelId: string;
  title: string;
  description?: string | null;
  start: Date;
  end: Date;
  epgChannelId?: string | null;
  createdAt: Date;
};

type MetadataObject = Realm.Object & {
  playlistId: string;
  lastUpdated: Date;
  sourceSignature?: string | null;
};

const ProgramSchema: Realm.ObjectSchema = {
  name: 'Program',
  primaryKey: 'id',
  properties: {
    id: 'string',
    playlistId: { type: 'string', indexed: true },
    channelId: { type: 'string', indexed: true },
    title: 'string',
    description: 'string?',
    start: { type: 'date', indexed: true },
    end: { type: 'date', indexed: true },
    epgChannelId: 'string?',
    createdAt: 'date',
  },
};

const MetadataSchema: Realm.ObjectSchema = {
  name: 'Metadata',
  primaryKey: 'playlistId',
  properties: {
    playlistId: 'string',
    lastUpdated: 'date',
    sourceSignature: 'string?',
  },
};

let realmPromise: Promise<Realm> | null = null;
let operationChain: Promise<void> = Promise.resolve();

// Query result cache with TTL
interface CacheEntry {
  data: Record<string, EPGProgram[]>;
  timestamp: number;
}

const queryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60000; // 1 minute cache TTL

// Build cache key from query parameters
const buildCacheKey = (
  playlistId: string,
  channelIds: string[],
  startTime: Date,
  endTime: Date,
  maxPrograms: number
): string => {
  const sortedChannelIds = [...channelIds].sort().join(',');
  return `${playlistId}:${sortedChannelIds}:${startTime.getTime()}:${endTime.getTime()}:${maxPrograms}`;
};

// Clear cache for a playlist (called when EPG data is refreshed)
export const clearQueryCache = (playlistId?: string): void => {
  if (playlistId) {
    // Clear only entries for this playlist
    const keysToDelete: string[] = [];
    queryCache.forEach((_, key) => {
      if (key.startsWith(`${playlistId}:`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => queryCache.delete(key));
  } else {
    // Clear all cache
    queryCache.clear();
  }
};

const getRealmInstance = async (): Promise<Realm> => {
  if (!realmPromise) {
    realmPromise = Realm.open({
      schema: [ProgramSchema, MetadataSchema],
      schemaVersion: 2, // Increment version due to schema change (added indexes)
    });
  }
  return realmPromise;
};

const enqueueRealmOperation = <T>(
  operation: (realm: Realm) => Promise<T> | T
): Promise<T> => {
  const nextOperation = operationChain.then(async () => {
    const realm = await getRealmInstance();
    return operation(realm);
  });

  operationChain = nextOperation
    .then(() => undefined)
    .catch(() => undefined);

  return nextOperation;
};

const mapProgramObject = (program: ProgramObject): EPGProgram => ({
  id: program.id,
  channelId: program.channelId,
  title: program.title,
  description: program.description ?? undefined,
  start: new Date(program.start),
  end: new Date(program.end),
});

const buildProgramPrimaryKey = (program: InsertableProgram): string =>
  `${program.playlistId}|${program.channelId}|${program.start}|${program.end}|${program.title ?? ''}`;

export const ensureEpgDatabase = async (): Promise<Realm> => getRealmInstance();

export const clearProgramsForPlaylist = async (playlistId: string): Promise<void> => {
  // Clear cache for this playlist
  clearQueryCache(playlistId);
  
  return enqueueRealmOperation(async (realm) => {
    realm.write(() => {
      const programs = realm
        .objects<ProgramObject>('Program')
        .filtered('playlistId == $0', playlistId);
      realm.delete(programs);

      const metadata = realm.objectForPrimaryKey<MetadataObject>('Metadata', playlistId);
      if (metadata) {
        realm.delete(metadata);
      }
    });
  });
};

export const setPlaylistMetadata = async (
  playlistId: string,
  lastUpdated: number,
  sourceSignature?: string | null
): Promise<void> =>
  enqueueRealmOperation(async (realm) => {
    realm.write(() => {
      realm.create(
        'Metadata',
        {
          playlistId,
          lastUpdated: new Date(lastUpdated),
          sourceSignature: sourceSignature ?? null,
        },
        Realm.UpdateMode.Modified
      );
    });
  });

export const getPlaylistMetadata = async (
  playlistId: string
): Promise<MetadataRow | null> => {
  const realm = await getRealmInstance();
  const metadata = realm.objectForPrimaryKey<MetadataObject>('Metadata', playlistId);

  if (!metadata) {
    return null;
  }

  return {
    playlistId: metadata.playlistId,
    lastUpdated: metadata.lastUpdated.getTime(),
    sourceSignature: metadata.sourceSignature ?? null,
  };
};

export const insertProgramsExclusive = async (
  playlistId: string,
  programs: InsertableProgram[]
): Promise<number> => {
  if (programs.length === 0) {
    return 0;
  }

  const inserted = await enqueueRealmOperation(async (realm) => {
    let count = 0;

    realm.write(() => {
      for (const program of programs) {
        const primaryKey = buildProgramPrimaryKey(program);
        const existing = realm.objectForPrimaryKey<ProgramObject>('Program', primaryKey);

        if (!existing) {
          realm.create('Program', {
            id: primaryKey,
            playlistId: program.playlistId,
            channelId: program.channelId,
            title: program.title,
            description: program.description ?? null,
            start: new Date(program.start),
            end: new Date(program.end),
            epgChannelId: program.epgChannelId ?? null,
            createdAt: new Date(),
          });
          count += 1;
        }
      }
    });

    return count;
  });

  // Clear cache when new programs are inserted
  if (inserted > 0) {
    clearQueryCache(playlistId);
  }

      return inserted;
};

export const queryProgramsForChannels = async (
  playlistId: string,
  channelIds: string[],
  options?: {
    startTime?: Date;
    endTime?: Date;
    maxProgramsPerChannel?: number;
  }
): Promise<Record<string, EPGProgram[]>> => {
  if (channelIds.length === 0) {
    return {};
  }

  // Default to 12 hours window if not specified (6 hours before and 6 hours after now)
  const now = new Date();
  const defaultStartTime = options?.startTime || new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const defaultEndTime = options?.endTime || new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const maxPrograms = options?.maxProgramsPerChannel || 50; // Limit to 50 programs per channel

  // Check cache first
  const cacheKey = buildCacheKey(playlistId, channelIds, defaultStartTime, defaultEndTime, maxPrograms);
  const cached = queryCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    // Return cached result, but ensure all requested channels are present
    const result: Record<string, EPGProgram[]> = { ...cached.data };
    channelIds.forEach((channelId) => {
      if (!result[channelId]) {
        result[channelId] = [];
      }
    });
    return result;
  }

  const realm = await getRealmInstance();

  // Initialize grouped result with empty arrays for all requested channels
      const grouped: Record<string, EPGProgram[]> = {};
  channelIds.forEach((channelId) => {
    grouped[channelId] = [];
  });

  try {
    // Single batched query for all channels at once
    // Build OR conditions for channelId: (channelId == id1) || (channelId == id2) || ...
    // This is more efficient than N separate queries
    const channelIdConditions = channelIds.map((id, index) => `channelId == $${index + 1}`).join(' || ');
    const filterString = `playlistId == $0 && (${channelIdConditions}) && start < $${channelIds.length + 1} && end > $${channelIds.length + 2}`;
    
    // Build parameters array: [playlistId, channelId1, channelId2, ..., endTime, startTime]
    const params: any[] = [playlistId, ...channelIds, defaultEndTime, defaultStartTime];
    
    // Query programs that overlap with the time window for any of the requested channels
    // A program overlaps if: (start < endTime) && (end > startTime)
    // Keep Realm Results lazy - don't convert to array yet
    const query = realm
      .objects<ProgramObject>('Program')
      .filtered(filterString, ...params)
      .sorted('start');

    // Lazy conversion optimization:
    // - Realm Results are lazy until we iterate
    // - We convert to array only once (not per-channel)
    // - Grouping happens in a single pass
    // - Only convert programs that match our channelIds (already filtered)
    const allPrograms = Array.from(query);

    // Group programs by channelId in a single pass
    // This is more efficient than multiple queries
    allPrograms.forEach((program) => {
      const channelId = program.channelId;
      if (grouped[channelId]) {
        // Convert Realm object to plain JS object only when needed
        grouped[channelId].push(mapProgramObject(program));
      }
    });

    // Apply maxPrograms limit per channel if specified
    if (maxPrograms > 0) {
      Object.keys(grouped).forEach((channelId) => {
        if (grouped[channelId].length > maxPrograms) {
          grouped[channelId] = grouped[channelId].slice(0, maxPrograms);
        }
      });
    }

    // Cache the result
    queryCache.set(cacheKey, {
      data: grouped,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.warn('[EPG DB] Error querying programs for channels:', error);
    // On error, ensure all channels have empty arrays
    channelIds.forEach((channelId) => {
      grouped[channelId] = [];
    });
  }

      return grouped;
};

export const pruneOldPrograms = async (
  playlistId: string,
  cutoffTimestamp: number
): Promise<void> => {
  // Clear cache when programs are pruned
  clearQueryCache(playlistId);
  
  return enqueueRealmOperation(async (realm) => {
    realm.write(() => {
      const programs = realm
        .objects<ProgramObject>('Program')
        .filtered('playlistId == $0 && end < $1', playlistId, new Date(cutoffTimestamp));
      realm.delete(programs);
    });
  });
};

export const debugDatabaseContents = async (playlistId?: string): Promise<void> => {
  try {
    const realm = await getRealmInstance();

    const totalPrograms = realm.objects<ProgramObject>('Program').length;
    console.log(`[DB DEBUG] Total programs in database: ${totalPrograms}`);

    if (playlistId) {
      const programs = realm
        .objects<ProgramObject>('Program')
        .filtered('playlistId == $0', playlistId);
      console.log(`[DB DEBUG] Programs for playlist ${playlistId}: ${programs.length}`);

      const recentPrograms = programs.sorted('start', true).slice(0, 5).map((program) => ({
        id: program.id,
        title: program.title,
        channelId: program.channelId,
        start: program.start,
        end: program.end,
      }));
      console.log('[DB DEBUG] Recent programs sample:', recentPrograms);
    }

    const metadataEntries = realm.objects<MetadataObject>('Metadata').map((meta) => ({
      playlistId: meta.playlistId,
      lastUpdated: meta.lastUpdated,
      sourceSignature: meta.sourceSignature ?? null,
    }));
    console.log('[DB DEBUG] Metadata entries:', metadataEntries);
  } catch (error) {
    console.error('[DB DEBUG] Error checking database:', error);
  }
};


