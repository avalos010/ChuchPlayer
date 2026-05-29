import {
  buildDatasetSignature,
  buildXtreamXmltvUrl,
  getActiveEpgUrls,
} from '../signatures';

describe('epg management signatures', () => {
  it('builds an xtream xmltv url', () => {
    expect(
      buildXtreamXmltvUrl('https://example.com/', 'user', 'pa ss'),
    ).toBe('https://example.com/xmltv.php?username=user&password=pa%20ss');
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
