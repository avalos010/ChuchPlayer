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
    playlistId: 'string',
    channelId: 'string',
    title: 'string',
    description: 'string?',
    start: 'date',
    end: 'date',
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

const getRealmInstance = async (): Promise<Realm> => {
  if (!realmPromise) {
    realmPromise = Realm.open({
      schema: [ProgramSchema, MetadataSchema],
      schemaVersion: 1,
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

export const clearProgramsForPlaylist = async (playlistId: string): Promise<void> =>
  enqueueRealmOperation(async (realm) => {
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

  return enqueueRealmOperation(async (realm) => {
      let inserted = 0;

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
              inserted += 1;
          }
        }
      });

      return inserted;
  });
};

export const queryProgramsForChannels = async (
  playlistId: string,
  channelIds: string[]
): Promise<Record<string, EPGProgram[]>> => {
  if (channelIds.length === 0) {
    return {};
  }

  const realm = await getRealmInstance();
      const grouped: Record<string, EPGProgram[]> = {};

  channelIds.forEach((channelId) => {
    const results = realm
      .objects<ProgramObject>('Program')
      .filtered('playlistId == $0 && channelId == $1', playlistId, channelId)
      .sorted('start');

    grouped[channelId] = results.map(mapProgramObject);
      });

      return grouped;
};

export const pruneOldPrograms = async (
  playlistId: string,
  cutoffTimestamp: number
): Promise<void> =>
  enqueueRealmOperation(async (realm) => {
    realm.write(() => {
      const programs = realm
        .objects<ProgramObject>('Program')
        .filtered('playlistId == $0 && end < $1', playlistId, new Date(cutoffTimestamp));
      realm.delete(programs);
    });
  });

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


