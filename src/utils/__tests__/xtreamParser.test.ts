import {
  parseXtreamStreams,
  parseXtreamVodStreams,
  buildXtreamStreamUrl,
  buildXtreamVodUrl,
  XtreamCodesCredentials,
  XtreamCodesStream,
  XtreamCodesCategory,
  XtreamCodesVodStream,
} from '../xtreamParser';

const CREDS: XtreamCodesCredentials = {
  serverUrl: 'https://xtream.example.com',
  username: 'testuser',
  password: 'testpass',
};

const CATEGORIES: XtreamCodesCategory[] = [
  { category_id: '1', category_name: 'News', parent_id: 0 },
  { category_id: '2', category_name: 'Sports', parent_id: 0 },
];

const makeStream = (overrides: Partial<XtreamCodesStream> = {}): XtreamCodesStream => ({
  num: 1,
  name: 'Test Channel',
  stream_type: 'live',
  stream_id: 101,
  stream_icon: 'https://example.com/logo.png',
  epg_channel_id: 'test.us',
  added: '1234567890',
  category_id: '1',
  category_ids: [1],
  custom_sid: '',
  tv_archive: 0,
  direct_source: '',
  tv_archive_duration: 0,
  ...overrides,
});

const makeVodStream = (overrides: Partial<XtreamCodesVodStream> = {}): XtreamCodesVodStream => ({
  num: 1,
  name: 'Example Movie',
  stream_type: 'movie',
  stream_id: 501,
  stream_icon: 'https://example.com/poster.jpg',
  category_id: '2',
  container_extension: 'mkv',
  rating: '8.2',
  plot: 'A test movie.',
  releaseDate: '2026-01-10',
  duration: '01:42:00',
  ...overrides,
});

describe('buildXtreamStreamUrl', () => {
  it('builds a valid .m3u8 stream URL', () => {
    const url = buildXtreamStreamUrl(CREDS, 101);
    expect(url).toBe('https://xtream.example.com/live/testuser/testpass/101.m3u8');
  });

  it('strips trailing slash from server URL', () => {
    const creds = { ...CREDS, serverUrl: 'https://xtream.example.com/' };
    const url = buildXtreamStreamUrl(creds, 101);
    expect(url).not.toContain('//live');
    expect(url).toContain('/live/');
  });

  it('URL-encodes special characters in credentials', () => {
    const creds = { ...CREDS, username: 'user@name', password: 'p@ss!' };
    const url = buildXtreamStreamUrl(creds, 42);
    expect(url).toContain(encodeURIComponent('user@name'));
    expect(url).toContain(encodeURIComponent('p@ss!'));
  });
});

describe('parseXtreamStreams', () => {
  it('converts streams to Channel objects', () => {
    const streams = [makeStream()];
    const channels = parseXtreamStreams(streams, CREDS, CATEGORIES);
    expect(channels).toHaveLength(1);
    const ch = channels[0];
    expect(ch.id).toBe('xtream-101');
    expect(ch.name).toBe('Test Channel');
    expect(ch.logo).toBe('https://example.com/logo.png');
    expect(ch.tvgId).toBe('test.us');
    expect(ch.url).toContain('/live/');
  });

  it('resolves category_id to category name', () => {
    const channels = parseXtreamStreams([makeStream({ category_id: '2' })], CREDS, CATEGORIES);
    expect(channels[0].group).toBe('Sports');
  });

  it('falls back to Uncategorized when category_id not in map', () => {
    const channels = parseXtreamStreams([makeStream({ category_id: '99' })], CREDS, CATEGORIES);
    expect(channels[0].group).toBe('Uncategorized');
  });

  it('sets catchupAvailable=true when tv_archive > 0', () => {
    const channels = parseXtreamStreams([makeStream({ tv_archive: 7 })], CREDS, CATEGORIES);
    expect(channels[0].catchupAvailable).toBe(true);
  });

  it('sets catchupAvailable=false when tv_archive = 0', () => {
    const channels = parseXtreamStreams([makeStream({ tv_archive: 0 })], CREDS, CATEGORIES);
    expect(channels[0].catchupAvailable).toBe(false);
  });

  it('returns empty array for null/undefined streams input', () => {
    expect(parseXtreamStreams(null as any, CREDS, CATEGORIES)).toEqual([]);
    expect(parseXtreamStreams(undefined as any, CREDS, CATEGORIES)).toEqual([]);
  });

  it('does not crash when categories is null/undefined', () => {
    const streams = [makeStream()];
    expect(() => parseXtreamStreams(streams, CREDS, null as any)).not.toThrow();
    expect(() => parseXtreamStreams(streams, CREDS, undefined as any)).not.toThrow();
  });

  it('skips null stream entries without throwing', () => {
    const streams = [makeStream(), null as any, makeStream({ stream_id: 202, name: 'Second' })];
    const channels = parseXtreamStreams(streams, CREDS, CATEGORIES);
    expect(channels).toHaveLength(2);
  });

  it('uses epg_channel_id as tvgId, falling back to custom_sid', () => {
    const noEpgId = makeStream({ epg_channel_id: '', custom_sid: 'custom.ch' });
    const channels = parseXtreamStreams([noEpgId], CREDS, CATEGORIES);
    expect(channels[0].tvgId).toBe('custom.ch');
  });

  it('sets tvgId to undefined when both epg_channel_id and custom_sid are empty', () => {
    const noIds = makeStream({ epg_channel_id: '', custom_sid: '' });
    const channels = parseXtreamStreams([noIds], CREDS, CATEGORIES);
    expect(channels[0].tvgId).toBeUndefined();
  });
});

describe('Xtream VOD', () => {
  it('builds a movie URL with the provider extension', () => {
    expect(buildXtreamVodUrl(CREDS, 501, 'mkv')).toBe(
      'https://xtream.example.com/movie/testuser/testpass/501.mkv',
    );
  });

  it('converts movie streams and resolves their categories', () => {
    const [movie] = parseXtreamVodStreams([makeVodStream()], CREDS, CATEGORIES);

    expect(movie).toMatchObject({
      id: 'xtream-vod-501',
      name: 'Example Movie',
      group: 'Sports',
      extension: 'mkv',
      rating: '8.2',
    });
    expect(movie.url).toContain('/movie/testuser/testpass/501.mkv');
  });
});
