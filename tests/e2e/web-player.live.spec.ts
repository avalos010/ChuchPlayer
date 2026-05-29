import { test, expect, type Page } from '@playwright/test';
import type { Channel, Playlist, Settings } from '../../src/types';
import { liveStreams } from './live-streams';

const KEYS = {
  playlists: '@chuchPlayer:playlists',
  settings: '@chuchPlayer:settings',
  lastChannel: '@chuchPlayer:lastChannel',
};

const livePlaylist: Omit<Playlist, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
} = {
  id: 'live-smoke-playlist',
  name: 'Live Smoke Playlist',
  url: 'https://fixtures.chuchplayer.local/live-smoke.m3u',
  sourceType: 'm3u',
  channels: liveStreams,
  epgUrls: [],
  createdAt: '2026-05-29T00:00:00.000Z',
  updatedAt: '2026-05-29T00:00:00.000Z',
};

const liveSettings: Settings = {
  autoPlay: true,
  showEPG: false,
  theme: 'dark',
  multiScreenEnabled: true,
  maxMultiScreens: 4,
  epgRefreshIntervalMinutes: 120,
  channelRefreshIntervalMinutes: 120,
  bufferMode: 'balanced',
  hardwareDecoder: true,
  infoBarTimeoutSeconds: 6,
  showChannelNumbers: true,
  clockFormat: '24h',
};

type StorageKeys = typeof KEYS;

interface SeedLiveFixture {
  keys: StorageKeys;
  playlist: typeof livePlaylist;
  settings: Settings;
  lastChannel: Channel;
}

async function seedLivePlaylist(page: Page) {
  await page.addInitScript(({ keys, playlist, settings, lastChannel }) => {
    window.localStorage.clear();
    window.localStorage.setItem(keys.playlists, JSON.stringify([playlist]));
    window.localStorage.setItem(keys.settings, JSON.stringify(settings));
    window.localStorage.setItem(keys.lastChannel, JSON.stringify(lastChannel));
  }, {
    keys: KEYS,
    playlist: livePlaylist,
    settings: liveSettings,
    lastChannel: liveStreams[0],
  } satisfies SeedLiveFixture);
}

async function expectVideoReady(page: Page) {
  const video = page.getByTestId('web-video');
  await expect(video).toBeVisible();

  await video.evaluate(async (element) => {
    const media = element as HTMLVideoElement;
    media.muted = true;
    await media.play().catch(() => undefined);
  });

  await expect.poll(
    async () => video.evaluate((element) => ({
      readyState: (element as HTMLVideoElement).readyState,
      duration: Number.isFinite((element as HTMLVideoElement).duration)
        ? (element as HTMLVideoElement).duration
        : 0,
      width: (element as HTMLVideoElement).videoWidth,
      height: (element as HTMLVideoElement).videoHeight,
    })),
    { timeout: 30_000 },
  ).toMatchObject({
    readyState: expect.any(Number),
    duration: expect.any(Number),
    width: expect.any(Number),
    height: expect.any(Number),
  });

  const state = await video.evaluate((element) => ({
    readyState: (element as HTMLVideoElement).readyState,
    duration: (element as HTMLVideoElement).duration,
    width: (element as HTMLVideoElement).videoWidth,
    height: (element as HTMLVideoElement).videoHeight,
  }));

  expect(state.readyState).toBeGreaterThanOrEqual(2);
  expect(state.duration).toBeGreaterThan(1);
  expect(state.width).toBeGreaterThan(0);
  expect(state.height).toBeGreaterThan(0);
}

test.beforeEach(async ({ page }) => {
  await page.route('https://fixtures.chuchplayer.local/**/*.svg', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#22c55e"/><text x="40" y="47" font-size="20" text-anchor="middle" fill="#020617">TV</text></svg>',
    });
  });
});

test('plays public HLS streams and changes channels with keyboard navigation', async ({ page }) => {
  await seedLivePlaylist(page);
  await page.goto('/');

  await expect(page.getByTestId('web-sidebar')).toBeVisible();
  await expect(page.getByTestId('web-channel-row-live-bunny-abr')).toContainText('Big Buck Bunny ABR');
  await expect(page.getByTestId('web-channel-row-live-bunny-480')).toContainText('Big Buck Bunny 480p');
  await expect(page.getByTestId('web-channel-row-live-tears-steel')).toContainText('Tears of Steel HLS');

  await page.getByTestId('web-channel-row-live-bunny-abr').click();
  await expect(page.getByTestId('web-info-overlay')).toContainText('Big Buck Bunny ABR');
  await expectVideoReady(page);

  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('web-info-overlay')).toContainText('Big Buck Bunny 480p');
  await expectVideoReady(page);

  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('web-info-overlay')).toContainText('Tears of Steel HLS');
  await expectVideoReady(page);
});
