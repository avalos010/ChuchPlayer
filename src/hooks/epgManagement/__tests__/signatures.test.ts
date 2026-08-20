import {
  buildDatasetSignature,
  buildM3uXmltvUrl,
  buildXtreamXmltvUrl,
  getActiveEpgUrls,
} from '../signatures';

describe('epg management signatures', () => {
  it('builds an xtream xmltv url', () => {
    expect(
      buildXtreamXmltvUrl('https://example.com/', 'user', 'pa ss'),
    ).toBe('https://example.com/xmltv.php?username=user&password=pa%20ss');
  });

  it('builds an authenticated xmltv url from an M3U provider url', () => {
    expect(
      buildM3uXmltvUrl(
        'https://example.com/get.php?username=user%40mail.com&password=pa%20ss&type=m3u_plus',
      ),
    ).toBe('https://example.com/xmltv.php?username=user%40mail.com&password=pa+ss');
  });

  it('uses M3U credentials when no explicit EPG URL is present', () => {
    expect(
      getActiveEpgUrls({
        id: '1',
        name: 'Playlist',
        url: 'https://example.com/get.php?username=user&password=secret&type=m3u_plus',
        sourceType: 'm3u',
        channels: [],
        epgUrls: [],
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      }),
    ).toEqual(['https://example.com/xmltv.php?username=user&password=secret']);
  });

  it('prefers explicit playlist epg urls', () => {
    expect(
      getActiveEpgUrls({
        id: '1',
        name: 'Playlist',
        url: 'https://playlist.test',
        sourceType: 'm3u',
        channels: [],
        epgUrls: [' https://epg.test/a.xml ', 'https://epg.test/a.xml'],
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      }),
    ).toEqual(['https://epg.test/a.xml']);
  });

  it('builds a stable dataset signature', () => {
    expect(
      buildDatasetSignature(
        {
          id: '1',
          name: 'Playlist',
          url: 'https://playlist.test',
          sourceType: 'm3u',
          channels: [],
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-02T00:00:00.000Z'),
        },
        'c1|c2',
        ['https://epg.test/a.xml'],
      ),
    ).toBe('1:1704153600000:c1|c2:https://epg.test/a.xml');
  });
});
