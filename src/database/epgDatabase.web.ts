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

// ─── IndexedDB setup ─────────────────────────────────────────────────────────

const DB_NAME = 'ChuchPlayerEPG';
const DB_VERSION = 1;
const STORE_PROGRAMS = 'programs';
const STORE_METADATA = 'metadata';

let _db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_PROGRAMS)) {
        // Compound key: playlistId + channelId + start (deduplicates naturally)
        const store = db.createObjectStore(STORE_PROGRAMS, {
          keyPath: ['playlistId', 'channelId', 'start'],
        });
        store.createIndex('byPlaylistChannel', ['playlistId', 'channelId']);
        store.createIndex('byPlaylistEnd', ['playlistId', 'end']);
      }

      if (!db.objectStoreNames.contains(STORE_METADATA)) {
        db.createObjectStore(STORE_METADATA, { keyPath: 'playlistId' });
      }
    };

    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };

    req.onerror = () => reject(req.error);
  });
}

function tx(
  db: IDBDatabase,
  stores: string | string[],
  mode: IDBTransactionMode,
): IDBTransaction {
  return db.transaction(stores, mode);
}

function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function promisifyTx(t: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(new Error('Transaction aborted'));
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const ensureEpgDatabase = async (): Promise<void> => {
  await openDb();
};

export const clearProgramsForPlaylist = async (playlistId: string): Promise<void> => {
  const db = await openDb();
  const t = tx(db, STORE_PROGRAMS, 'readwrite');
  const store = t.objectStore(STORE_PROGRAMS);
  const index = store.index('byPlaylistChannel');

  // Gather all keys for this playlist then delete them
  const range = IDBKeyRange.bound([playlistId], [playlistId, '￿']);
  const keys: IDBValidKey[] = await promisifyRequest(index.getAllKeys(range));

  for (const key of keys) {
    store.delete(key);
  }

  await promisifyTx(t);
};

export const setPlaylistMetadata = async (
  playlistId: string,
  lastUpdated: number,
  sourceSignature?: string | null,
): Promise<void> => {
  const db = await openDb();
  const t = tx(db, STORE_METADATA, 'readwrite');
  t.objectStore(STORE_METADATA).put({ playlistId, lastUpdated, sourceSignature: sourceSignature ?? null });
  await promisifyTx(t);
};

export const getPlaylistMetadata = async (playlistId: string): Promise<MetadataRow | null> => {
  const db = await openDb();
  const t = tx(db, STORE_METADATA, 'readonly');
  const row = await promisifyRequest<MetadataRow | undefined>(
    t.objectStore(STORE_METADATA).get(playlistId),
  );
  return row ?? null;
};

export const insertProgramsExclusive = async (
  playlistId: string,
  programs: InsertableProgram[],
): Promise<number> => {
  if (programs.length === 0) return 0;

  const db = await openDb();
  const t = tx(db, STORE_PROGRAMS, 'readwrite');
  const store = t.objectStore(STORE_PROGRAMS);
  let inserted = 0;

  for (const p of programs) {
    // put() overwrites on duplicate compound key — idempotent on re-ingestion
    store.put({
      playlistId,
      channelId: p.channelId,
      start: p.start,
      end: p.end,
      title: p.title,
      description: p.description ?? '',
      epgChannelId: p.epgChannelId ?? '',
    });
    inserted++;
  }

  await promisifyTx(t);
  return inserted;
};

export const queryProgramsForChannels = async (
  playlistId: string,
  channelIds: string[],
): Promise<Record<string, EPGProgram[]>> => {
  if (channelIds.length === 0) return {};

  const db = await openDb();
  const t = tx(db, STORE_PROGRAMS, 'readonly');
  const store = t.objectStore(STORE_PROGRAMS);
  const index = store.index('byPlaylistChannel');
  const now = Date.now();
  const windowStart = now - 12 * 60 * 60 * 1000;
  const windowEnd = now + 36 * 60 * 60 * 1000;

  const grouped: Record<string, EPGProgram[]> = {};

  await Promise.all(
    channelIds.map(async (channelId) => {
      const range = IDBKeyRange.bound([playlistId, channelId], [playlistId, channelId, '￿']);
      const rows = await promisifyRequest<any[]>(index.getAll(range));

      grouped[channelId] = rows
        .filter((r) => r.end >= windowStart && r.start <= windowEnd)
        .map((r, i) => ({
          id: `${playlistId}:${channelId}:${r.start}:${i}`,
          channelId: r.channelId,
          title: r.title,
          description: r.description || undefined,
          start: new Date(r.start),
          end: new Date(r.end),
        }))
        .sort((a, b) => a.start.getTime() - b.start.getTime());
    }),
  );

  return grouped;
};

export const pruneOldPrograms = async (
  playlistId: string,
  cutoffTimestamp: number,
): Promise<void> => {
  const db = await openDb();
  const t = tx(db, STORE_PROGRAMS, 'readwrite');
  const store = t.objectStore(STORE_PROGRAMS);
  const index = store.index('byPlaylistEnd');

  // All records for this playlist whose end < cutoff
  const range = IDBKeyRange.bound([playlistId, 0], [playlistId, cutoffTimestamp]);
  const keys: IDBValidKey[] = await promisifyRequest(index.getAllKeys(range));

  for (const key of keys) {
    store.delete(key);
  }

  await promisifyTx(t);
};

export const debugDatabaseContents = async (playlistId?: string): Promise<void> => {
  try {
    if (playlistId) {
      const meta = await getPlaylistMetadata(playlistId);
      console.log('[DB DEBUG] Metadata:', meta);
    }
    console.log('[DB DEBUG] IndexedDB EPG store is active');
  } catch (e) {
    console.error('[DB DEBUG] Error:', e);
  }
};
