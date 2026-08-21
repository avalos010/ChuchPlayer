import AsyncStorage from '@react-native-async-storage/async-storage';

const DATABASE_NAME = 'chuchPlayer';
const STORE_NAME = 'playlists';
const DATABASE_VERSION = 1;

let databasePromise: Promise<IDBDatabase | null> | null = null;

const openDatabase = (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (databasePromise) return databasePromise;

  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((): IDBDatabase | null => null);

  databasePromise = opening;
  return opening;
};

const readDatabaseValue = async (key: string): Promise<string | null> => {
  const database = await openDatabase();
  if (!database) return null;

  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
    request.onerror = () => reject(request.error);
  });
};

const writeDatabaseEntries = async (entries: [string, string][]): Promise<boolean> => {
  const database = await openDatabase();
  if (!database) return false;

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    entries.forEach(([key, value]) => store.put(value, key));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  return true;
};

const removeDatabaseKeys = async (keys: string[]): Promise<void> => {
  const database = await openDatabase();
  if (!database) return;

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    keys.forEach((key) => store.delete(key));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
};

const getItem = async (key: string): Promise<string | null> => {
  const value = await readDatabaseValue(key);
  return value ?? AsyncStorage.getItem(key);
};

const multiSet = async (entries: [string, string][]): Promise<void> => {
  if (await writeDatabaseEntries(entries)) return;
  await AsyncStorage.multiSet(entries);
};

const multiRemove = async (keys: string[]): Promise<void> => {
  await Promise.all([
    removeDatabaseKeys(keys),
    AsyncStorage.multiRemove(keys),
  ]);
};

export const playlistStorage = {
  getItem,
  setItem: async (key: string, value: string) => multiSet([[key, value]]),
  removeItem: async (key: string) => multiRemove([key]),
  multiGet: async (keys: string[]): Promise<[string, string | null][]> =>
    Promise.all(keys.map(async (key) => [key, await getItem(key)] as [string, string | null])),
  multiSet,
  multiRemove,
};
