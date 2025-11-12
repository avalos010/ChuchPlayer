import * as SQLite from 'expo-sqlite';
import { EPGProgram } from '../types';

const DB_NAME = 'epg.db';
const INSERT_BATCH_SIZE = 15; // Smaller batches for smoother insertions
const LOCK_RETRY_ATTEMPTS = 5;
const LOCK_RETRY_BASE_DELAY_MS = 75;
const OPERATION_TIMEOUT_MS = 30000; // 30 seconds timeout for operations

export type InsertableProgram = {
  playlistId: string;
  channelId: string;
  title: string;
  description?: string;
  start: number;
  end: number;
  epgChannelId?: string;
};

type ProgramRow = {
  id: number;
  playlistId: string;
  channelId: string;
  title: string;
  description?: string | null;
  start: number;
  end: number;
  epgChannelId?: string | null;
};

type MetadataRow = {
  playlistId: string;
  lastUpdated: number;
  sourceSignature?: string | null;
};

let operationQueue: Promise<unknown> = Promise.resolve();
let queueErrorCount = 0;
const MAX_QUEUE_ERRORS = 3;

const enqueueDatabaseOperation = <T>(operation: () => Promise<T>): Promise<T> => {
  const wrappedOperation = async (): Promise<T> => {
    try {
      const result = await withTimeout(operation(), OPERATION_TIMEOUT_MS);
      queueErrorCount = 0; // Reset error count on success
      return result;
    } catch (error) {
      queueErrorCount++;
      console.error('[EPG][DB] Operation failed:', error);

      // If we have too many consecutive errors, reset the queue
      if (queueErrorCount >= MAX_QUEUE_ERRORS) {
        console.warn('[EPG][DB] Too many consecutive errors, resetting operation queue');
        operationQueue = Promise.resolve();
        queueErrorCount = 0;
      }

      throw error;
    }
  };

  const queued = operationQueue.then(wrappedOperation, wrappedOperation);
  operationQueue = queued.then(
    () => undefined,
    () => undefined
  );
  return queued;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
};

const isDatabaseLockedError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message?.toLowerCase?.() ?? '';
  return message.includes('database is locked') || message.includes('busy');
};

const runWithLockRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < LOCK_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isDatabaseLockedError(error) || attempt === LOCK_RETRY_ATTEMPTS - 1) {
        throw error;
      }
      const delayMs = LOCK_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn('[EPG][DB] database locked, retrying', {
        attempt: attempt + 1,
        delayMs,
      });
      await delay(delayMs);
    }
  }

  throw lastError;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initialized = false;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DB_NAME);
  }
  return databasePromise;
};

const checkDatabaseHealth = async (): Promise<boolean> => {
  const now = Date.now();
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return true; // Skip health check if done recently
  }

  try {
    const db = await getDatabase();
    // Simple health check query
    await db.getFirstAsync('SELECT 1 as health_check');
    lastHealthCheck = now;
    return true;
  } catch (error) {
    console.warn('[EPG][DB] Health check failed:', error);
    // Reset database connection on failure
    databasePromise = null;
    initialized = false;
    return false;
  }
};

export const ensureEpgDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  // Perform health check first
  const isHealthy = await checkDatabaseHealth();
  if (!isHealthy) {
    console.log('[EPG][DB] Database connection reset due to health check failure');
  }

  const db = await getDatabase();
  if (initialized && isHealthy) {
    return db;
  }

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS epg_programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlistId TEXT NOT NULL,
      channelId TEXT NOT NULL,
      title TEXT,
      description TEXT,
      start INTEGER NOT NULL,
      end INTEGER NOT NULL,
      epgChannelId TEXT,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_epg_programs_unique
      ON epg_programs (playlistId, channelId, start, end, title);
    CREATE INDEX IF NOT EXISTS idx_epg_programs_channel_start
      ON epg_programs (playlistId, channelId, start);
    CREATE TABLE IF NOT EXISTS epg_metadata (
      playlistId TEXT PRIMARY KEY,
      lastUpdated INTEGER NOT NULL,
      sourceSignature TEXT
    );
  `);

  initialized = true;
  return db;
};

export const clearProgramsForPlaylist = async (playlistId: string): Promise<void> => {
  await enqueueDatabaseOperation(() =>
    runWithLockRetry(async () => {
    const db = await ensureEpgDatabase();
    await db.runAsync('DELETE FROM epg_programs WHERE playlistId = ?', [playlistId]);
    await db.runAsync('DELETE FROM epg_metadata WHERE playlistId = ?', [playlistId]);
    })
  );
};

export const setPlaylistMetadata = async (
  playlistId: string,
  lastUpdated: number,
  sourceSignature?: string | null
): Promise<void> => {
  await enqueueDatabaseOperation(() =>
    runWithLockRetry(async () => {
      const db = await ensureEpgDatabase();
      await db.runAsync(
        `
          INSERT INTO epg_metadata (playlistId, lastUpdated, sourceSignature)
          VALUES (?, ?, ?)
          ON CONFLICT(playlistId) DO UPDATE SET
            lastUpdated = excluded.lastUpdated,
            sourceSignature = excluded.sourceSignature
        `,
        [playlistId, lastUpdated, sourceSignature ?? null]
      );
    })
  );
};

export const getPlaylistMetadata = async (
  playlistId: string
): Promise<MetadataRow | null> => {
  const db = await ensureEpgDatabase();
  const row = await db.getFirstAsync<MetadataRow>(
    'SELECT playlistId, lastUpdated, sourceSignature FROM epg_metadata WHERE playlistId = ?',
    [playlistId]
  );
  return row ?? null;
};

export const insertProgramsExclusive = async (
  playlistId: string,
  programs: InsertableProgram[]
): Promise<number> => {
  if (programs.length === 0) {
    return 0;
  }

  return enqueueDatabaseOperation(() =>
    runWithLockRetry(async () => {
      const db = await ensureEpgDatabase();
      let inserted = 0;

      await db.withExclusiveTransactionAsync(async (txn) => {
        let statement: SQLite.SQLiteStatement | null = null;

        try {
          statement = await txn.prepareAsync(
            `
              INSERT OR IGNORE INTO epg_programs
                (playlistId, channelId, title, description, start, end, epgChannelId)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `
          );

          for (let i = 0; i < programs.length; i += INSERT_BATCH_SIZE) {
            const batch = programs.slice(i, i + INSERT_BATCH_SIZE);
            for (const program of batch) {
              await statement.executeAsync([
                program.playlistId,
                program.channelId,
                program.title,
                program.description ?? null,
                program.start,
                program.end,
                program.epgChannelId ?? null,
              ]);
              inserted += 1;
            }
          }
        } catch (error) {
          console.error('[EPG][DB] Error during batch insert:', error);
          throw error; // Re-throw to trigger transaction rollback
        } finally {
          if (statement) {
            try {
              await statement.finalizeAsync();
            } catch (finalizeError) {
              console.warn('[EPG][DB] Failed to finalize statement:', finalizeError);
              // Don't throw here as the transaction might already be rolling back
            }
          }
        }
      });

      return inserted;
    })
  );
};

export const queryProgramsForChannels = async (
  playlistId: string,
  channelIds: string[]
): Promise<Record<string, EPGProgram[]>> => {
  if (channelIds.length === 0) {
    return {};
  }

  return enqueueDatabaseOperation(() =>
    runWithLockRetry(async () => {
      const db = await ensureEpgDatabase();
      const placeholders = channelIds.map(() => '?').join(',');

      const rows = await db.getAllAsync<ProgramRow>(
        `
          SELECT id, playlistId, channelId, title, description, start, end, epgChannelId
          FROM epg_programs
          WHERE playlistId = ? AND channelId IN (${placeholders})
          ORDER BY channelId ASC, start ASC
        `,
        [playlistId, ...channelIds]
      );

      const grouped: Record<string, EPGProgram[]> = {};

      rows.forEach((row) => {
        if (!grouped[row.channelId]) {
          grouped[row.channelId] = [];
        }

        grouped[row.channelId].push({
          id: `${row.channelId}-${row.start}-${row.end}-${row.id}`,
          channelId: row.channelId,
          title: row.title ?? 'Untitled',
          description: row.description ?? undefined,
          start: new Date(row.start),
          end: new Date(row.end),
        });
      });

      return grouped;
    })
  );
};

export const pruneOldPrograms = async (
  playlistId: string,
  cutoffTimestamp: number
): Promise<void> => {
  await enqueueDatabaseOperation(() =>
    runWithLockRetry(async () => {
      const db = await ensureEpgDatabase();
      await db.runAsync(
        'DELETE FROM epg_programs WHERE playlistId = ? AND end < ?',
        [playlistId, cutoffTimestamp]
      );
    })
  );
};

// Debug function to check database contents
export const debugDatabaseContents = async (playlistId?: string): Promise<void> => {
  try {
    const db = await ensureEpgDatabase();

    // Check total program count
    const totalPrograms = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM epg_programs'
    );
    console.log(`[DB DEBUG] Total programs in database: ${totalPrograms?.count ?? 0}`);

    // Check programs for specific playlist if provided
    if (playlistId) {
      const playlistPrograms = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM epg_programs WHERE playlistId = ?',
        [playlistId]
      );
      console.log(`[DB DEBUG] Programs for playlist ${playlistId}: ${playlistPrograms?.count ?? 0}`);

      // Get a sample of recent programs
      const recentPrograms = await db.getAllAsync(
        'SELECT id, title, start, end, channelId FROM epg_programs WHERE playlistId = ? ORDER BY start DESC LIMIT 5',
        [playlistId]
      );
      console.log('[DB DEBUG] Recent programs sample:', recentPrograms);
    }

    // Check metadata
    const metadata = await db.getAllAsync('SELECT * FROM epg_metadata');
    console.log('[DB DEBUG] Metadata entries:', metadata);

  } catch (error) {
    console.error('[DB DEBUG] Error checking database:', error);
  }
};


