import { test, expect, type Page } from '@playwright/test';
import type { Channel, Playlist, Settings } from '../../src/types';

const KEYS = {
  playlists: '@chuchPlayer:playlists',
  settings: '@chuchPlayer:settings',
  lastChannel: '@chuchPlayer:lastChannel',
  e2ePrograms: '@chuchPlayer:e2ePrograms',
};

const channels: Channel[] = [
  {
    id: 'e2e-news',
    name: 'E2E News',
    url: 'https://fixtures.chuchplayer.local/news.m3u8',
    logo: 'https://fixtures.chuchplayer.local/news-logo.svg',
    group: 'News',
    tvgId: 'e2e.news',
    number: 101,
  },
  {
    id: 'e2e-sports',
    name: 'Sports Arena',
    url: 'https://fixtures.chuchplayer.local/sports.m3u8',
    logo: 'https://fixtures.chuchplayer.local/sports-logo.svg',
    group: 'Sports',
    tvgId: 'e2e.sports',
    number: 202,
    catchupAvailable: true,
  },
  {
    id: 'e2e-kids',
    name: 'Kids Planet',
    url: 'https://fixtures.chuchplayer.local/kids.m3u8',
    logo: 'https://fixtures.chuchplayer.local/kids-logo.svg',
    group: 'Kids',
    tvgId: 'e2e.kids',
    number: 303,
  },
];

const baseSettings: Settings = {
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
  showChannelNumbers: false,
  clockFormat: '24h',
};

interface StoredProgram {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  catchupAvailable?: boolean;
  catchupUrl?: string;
}

type StoredProgramsByChannel = Record<string, StoredProgram[]>;

const buildPrograms = (): StoredProgramsByChannel => {
  const now = Date.now();
  const iso = (offsetMinutes: number) => new Date(now + offsetMinutes * 60_000).toISOString();

  return {
    'e2e-news': [
      {
        id: 'news-now',
        channelId: 'e2e-news',
        title: 'Morning News Desk',
        description: 'A deterministic current affairs program for E2E.',
        start: iso(-20),
        end: iso(40),
      },
      {
        id: 'news-next',
        channelId: 'e2e-news',
        title: 'Markets Today',
        start: iso(40),
        end: iso(100),
      },
    ],
    'e2e-sports': [
      {
        id: 'sports-replay',
        channelId: 'e2e-sports',
        title: 'Replay Match',
        start: iso(-180),
        end: iso(-120),
        catchupAvailable: true,
        catchupUrl: 'https://fixtures.chuchplayer.local/replay-match.m3u8',
      },
      {
        id: 'sports-live',
        channelId: 'e2e-sports',
        title: 'Live Match Center',
        start: iso(-10),
        end: iso(80),
      },
    ],
    'e2e-kids': [
      {
        id: 'kids-now',
        channelId: 'e2e-kids',
        title: 'Cartoon Hour',
        start: iso(-5),
        end: iso(55),
      },
    ],
  };
};

const playlist: Omit<Playlist, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
} = {
  id: 'e2e-playlist',
  name: 'E2E Fixture Playlist',
  url: 'https://fixtures.chuchplayer.local/playlist.m3u',
  sourceType: 'm3u',
  channels,
  epgUrls: ['https://fixtures.chuchplayer.local/e2e.xml'],
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-29T00:00:00.000Z',
};

const epgXml = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="e2e.news"><display-name>E2E News</display-name></channel>
  <channel id="e2e.sports"><display-name>Sports Arena</display-name></channel>
  <programme channel="e2e.news" start="20260529090000 +0000" stop="20260529100000 +0000"><title>Morning News Desk</title></programme>
  <programme channel="e2e.sports" start="20260529080000 +0000" stop="20260529090000 +0000"><title>Replay Match</title></programme>
</tv>`;

interface SeedOverrides {
  lastChannel?: Channel;
  settings?: Partial<Settings>;
}

type StorageKeys = typeof KEYS;

interface SeedFixture {
  keys: StorageKeys;
  fixture: {
    playlist: typeof playlist;
    lastChannel: Channel;
    settings: Settings;
    programs: StoredProgramsByChannel;
  };
}

async function seedApp(page: Page, overrides: SeedOverrides = {}) {
  const data = {
    playlist,
    lastChannel: overrides.lastChannel || channels[0],
    settings: { ...baseSettings, ...(overrides.settings || {}) },
    programs: buildPrograms(),
  };

  await page.addInitScript(({ keys, fixture }) => {
    window.localStorage.clear();
    window.localStorage.setItem(keys.playlists, JSON.stringify([fixture.playlist]));
    window.localStorage.setItem(keys.settings, JSON.stringify(fixture.settings));
    window.localStorage.setItem(keys.lastChannel, JSON.stringify(fixture.lastChannel));
    window.localStorage.setItem(keys.e2ePrograms, JSON.stringify(fixture.programs));
  }, { keys: KEYS, fixture: data } satisfies SeedFixture);
}

async function bootPlayer(page: Page, overrides?: SeedOverrides) {
  await seedApp(page, overrides);
  await page.goto('/');
  await expect(page.getByTestId('web-sidebar')).toBeVisible();
  await expect(page.getByTestId('web-channel-row-e2e-news')).toContainText('E2E News');
}

test.beforeEach(async ({ page }) => {
  await page.route('https://fixtures.chuchplayer.local/e2e.xml', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/xml',
      body: epgXml,
    });
  });

  await page.route('https://fixtures.chuchplayer.local/**/*.svg', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#0ea5e9"/></svg>',
    });
  });

  await page.route('https://fixtures.chuchplayer.local/**/*.m3u8', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/vnd.apple.mpegurl',
      body: '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-ENDLIST\n',
    });
  });
});

test('clicking a side-list channel tunes without opening the full EPG', async ({ page }) => {
  await bootPlayer(page);

  await page.getByTestId('web-channel-row-e2e-sports').click();

  await expect(page.getByTestId('web-sidebar')).toBeHidden();
  await expect(page.getByTestId('web-main-epg')).toHaveCount(0);
  await expect(page.getByTestId('web-info-overlay')).toContainText('Sports Arena');
});

test('EPG button opens a full guide with programs, catchup, and PiP; close and Escape dismiss it', async ({ page }) => {
  await bootPlayer(page);
  await page.getByTestId('web-channel-row-e2e-news').click();

  await page.getByTestId('web-epg-button').click();

  await expect(page.getByTestId('web-main-epg')).toBeVisible();
  await expect(page.getByTestId('web-main-epg-pip')).toBeVisible();
  await expect(page.getByTestId('web-main-epg')).toContainText('Morning News Desk');
  await expect(page.getByTestId('web-main-epg')).toContainText('Replay Match');
  await expect(page.getByTestId('web-main-epg')).toContainText('Kids Planet');

  await page.getByTestId('web-main-epg-close').click();
  await expect(page.getByTestId('web-main-epg')).toHaveCount(0);

  await page.getByTestId('web-epg-button').click();
  await expect(page.getByTestId('web-main-epg')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('web-main-epg')).toHaveCount(0);
});

test('group rail filters the side channel list', async ({ page }) => {
  await bootPlayer(page);

  await page.getByTestId('web-groups-button').click();
  await expect(page.getByTestId('web-group-rail')).toBeVisible();

  await page.getByTestId('web-group-sports').click();

  await expect(page.getByTestId('web-channel-row-e2e-sports')).toBeVisible();
  await expect(page.getByTestId('web-channel-row-e2e-news')).toHaveCount(0);
  await expect(page.getByText('1 channels')).toBeVisible();
});

test('group chips filter the full EPG', async ({ page }) => {
  await bootPlayer(page);
  await page.getByTestId('web-channel-row-e2e-news').click();
  await page.getByTestId('web-epg-button').click();

  await page.getByTestId('web-main-epg-group-sports').click();

  await expect(page.getByTestId('web-main-epg-channel-e2e-sports')).toBeVisible();
  await expect(page.getByTestId('web-main-epg-channel-e2e-news')).toHaveCount(0);
  await expect(page.getByTestId('web-main-epg-channel-e2e-kids')).toHaveCount(0);
});

test('keyboard navigation opens the list, tunes channels, and toggles the EPG', async ({ page }) => {
  await bootPlayer(page);

  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('web-info-overlay')).toContainText('Sports Arena');

  await page.keyboard.press('Enter');
  await expect(page.getByTestId('web-sidebar')).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('web-main-epg')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('web-main-epg')).toHaveCount(0);

  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('web-sidebar')).toBeVisible();
});

test('saved interface options drive web UI state', async ({ page }) => {
  await bootPlayer(page, {
    settings: {
      showChannelNumbers: true,
      clockFormat: '12h',
      showEPG: true,
      infoBarTimeoutSeconds: 0,
    },
  });

  await expect(page.getByTestId('web-main-epg')).toBeVisible();
  await expect(page.getByTestId('web-main-epg-channel-e2e-news')).toContainText('101');
  await expect(page.getByTestId('web-clock')).toContainText(/AM|PM/);

  await page.getByTestId('web-main-epg-close').click();
  await page.getByTestId('web-channel-row-e2e-news').click();
  await expect(page.getByTestId('web-sidebar')).toHaveCount(0);

  await page.waitForTimeout(6500);
  await expect(page.getByTestId('web-info-overlay')).toBeVisible();
});
