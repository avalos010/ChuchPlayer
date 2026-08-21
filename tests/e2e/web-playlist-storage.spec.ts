import { expect, test } from '@playwright/test';

declare const require: (id: string) => any;

test('stores a playlist larger than localStorage quota in IndexedDB', async ({ page }) => {
  const typescript = require('typescript');
  const source = require('node:fs').readFileSync('src/utils/playlistStorage.web.ts', 'utf8');
  const compiledSource = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2020,
    },
  }).outputText;

  await page.goto('/__e2e__/blank.html');
  const storage = await page.evaluate(async (moduleSource) => {
    const legacy = new Map<string, string>();
    const localWrites: string[] = [];
    const asyncStorage = {
      getItem: async (key: string) => legacy.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        localWrites.push(key);
        legacy.set(key, value);
      },
      removeItem: async (key: string) => legacy.delete(key),
      multiGet: async (keys: string[]) => keys.map((key) => [key, legacy.get(key) ?? null]),
      multiSet: async (entries: [string, string][]) => {
        entries.forEach(([key, value]) => {
          localWrites.push(key);
          legacy.set(key, value);
        });
      },
      multiRemove: async (keys: string[]) => keys.forEach((key) => legacy.delete(key)),
    };
    const loadedModule = { exports: {} as { playlistStorage?: typeof asyncStorage } };
    const load = new Function('require', 'module', 'exports', moduleSource);
    load(
      (id: string) => {
        if (id === '@react-native-async-storage/async-storage') {
          return { __esModule: true, default: asyncStorage };
        }
        throw new Error(`Unexpected module: ${id}`);
      },
      loadedModule,
      loadedModule.exports,
    );
    const backend = loadedModule.exports.playlistStorage!;
    const entries = Array.from({ length: 20 }, (_, index): [string, string] => [
      `@chuchPlayer:playlist:v2:test:channels:${index}`,
      `${index}:`.padEnd(350_000, 'x'),
    ]);

    await backend.multiSet(entries);
    const values = await backend.multiGet(entries.map(([key]) => key));
    legacy.set('legacy-playlist', 'legacy-value');

    return {
      bytes: values.reduce((total, [, value]) => total + (value?.length ?? 0), 0),
      legacyValue: await backend.getItem('legacy-playlist'),
      localWrites,
      rows: values.length,
    };
  }, compiledSource);

  expect(storage.bytes).toBeGreaterThan(5_000_000);
  expect(storage.rows).toBe(20);
  expect(storage.localWrites).toEqual([]);
  expect(storage.legacyValue).toBe('legacy-value');
});
