import { parseM3U } from '../m3uParser';

const BASIC_M3U = `#EXTM3U
#EXTINF:-1 tvg-id="cnn.us" tvg-name="CNN" tvg-logo="https://example.com/cnn.png" group-title="News",CNN
https://stream.example.com/cnn.m3u8`;

const MULTI_GROUP_M3U = `#EXTM3U
#EXTINF:-1 tvg-id="cnn.us" group-title="News",CNN
https://stream.example.com/cnn.m3u8
#EXTINF:-1 tvg-id="espn.us" group-title="Sports",ESPN
https://stream.example.com/espn.m3u8
#EXTINF:-1 tvg-id="hbo.us" group-title="Movies",HBO
https://stream.example.com/hbo.m3u8`;

const NO_METADATA_M3U = `#EXTM3U
#EXTINF:-1,Bare Channel
https://stream.example.com/bare.m3u8`;

const EPG_URL_M3U = `#EXTM3U url-tvg="https://epg.example.com/guide.xml"
#EXTINF:-1 tvg-id="abc.us",ABC
https://stream.example.com/abc.m3u8`;

const TVG_URL_M3U = `#EXTM3U tvg-url="https://epg.example.com/tvg.xml"
#EXTINF:-1 tvg-id="nbc.us",NBC
https://stream.example.com/nbc.m3u8`;

describe('parseM3U', () => {
  describe('channel parsing', () => {
    it('parses a basic channel with all metadata', () => {
      const { channels } = parseM3U(BASIC_M3U);
      expect(channels).toHaveLength(1);
      const ch = channels[0];
      expect(ch.name).toBe('CNN');
      expect(ch.tvgId).toBe('cnn.us');
      expect(ch.logo).toBe('https://example.com/cnn.png');
      expect(ch.group).toBe('News');
      expect(ch.url).toBe('https://stream.example.com/cnn.m3u8');
    });

    it('uses tvg-name when present instead of display name after comma', () => {
      const m3u = `#EXTM3U
#EXTINF:-1 tvg-name="CNN International",CNN Old Name
https://stream.example.com/cnn.m3u8`;
      const { channels } = parseM3U(m3u);
      expect(channels[0].name).toBe('CNN International');
    });

    it('falls back to display name after comma when tvg-name absent', () => {
      const { channels } = parseM3U(NO_METADATA_M3U);
      expect(channels[0].name).toBe('Bare Channel');
    });

    it('sets logo to undefined when tvg-logo is absent', () => {
      const { channels } = parseM3U(NO_METADATA_M3U);
      expect(channels[0].logo).toBeUndefined();
    });

    it('sets tvgId to undefined when tvg-id is empty', () => {
      const { channels } = parseM3U(NO_METADATA_M3U);
      expect(channels[0].tvgId).toBeUndefined();
    });

    it('defaults group to Uncategorized when group-title is absent', () => {
      const { channels } = parseM3U(NO_METADATA_M3U);
      expect(channels[0].group).toBe('Uncategorized');
    });

    it('parses multiple channels with correct groups', () => {
      const { channels } = parseM3U(MULTI_GROUP_M3U);
      expect(channels).toHaveLength(3);
      expect(channels[0].group).toBe('News');
      expect(channels[1].group).toBe('Sports');
      expect(channels[2].group).toBe('Movies');
    });

    it('supports rtmp:// stream URLs', () => {
      const m3u = `#EXTM3U
#EXTINF:-1,RTMP Channel
rtmp://stream.example.com/live/channel`;
      const { channels } = parseM3U(m3u);
      expect(channels).toHaveLength(1);
      expect(channels[0].url).toBe('rtmp://stream.example.com/live/channel');
    });

    it('ignores EXTINF blocks with no following URL', () => {
      const m3u = `#EXTM3U
#EXTINF:-1,Orphaned
#EXTINF:-1,Real Channel
https://stream.example.com/real.m3u8`;
      const { channels } = parseM3U(m3u);
      expect(channels).toHaveLength(1);
      expect(channels[0].name).toBe('Real Channel');
    });
  });

  describe('EPG URL extraction', () => {
    it('extracts url-tvg from header', () => {
      const { epgUrls } = parseM3U(EPG_URL_M3U);
      expect(epgUrls).toContain('https://epg.example.com/guide.xml');
    });

    it('extracts tvg-url from header', () => {
      const { epgUrls } = parseM3U(TVG_URL_M3U);
      expect(epgUrls).toContain('https://epg.example.com/tvg.xml');
    });

    it('deduplicates EPG URLs appearing in both attributes', () => {
      const m3u = `#EXTM3U url-tvg="https://epg.example.com/guide.xml" tvg-url="https://epg.example.com/guide.xml"
#EXTINF:-1,CH
https://stream.example.com/ch.m3u8`;
      const { epgUrls } = parseM3U(m3u);
      expect(epgUrls.filter((u) => u === 'https://epg.example.com/guide.xml')).toHaveLength(1);
    });

    it('returns empty epgUrls array when no EPG URL in header', () => {
      const { epgUrls } = parseM3U(BASIC_M3U.replace('url-tvg', ''));
      // BASIC_M3U has no url-tvg; epgUrls should be empty
      expect(epgUrls).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('returns empty channels and epgUrls for empty input', () => {
      const result = parseM3U('');
      expect(result.channels).toEqual([]);
      expect(result.epgUrls).toEqual([]);
    });

    it('does not throw on malformed EXTINF lines', () => {
      const m3u = `#EXTM3U
#EXTINF:
https://stream.example.com/ch.m3u8`;
      expect(() => parseM3U(m3u)).not.toThrow();
    });

    it('handles semicolon-delimited group-title by taking first segment', () => {
      const m3u = `#EXTM3U
#EXTINF:-1 group-title="Sports;HD;4K",Test
https://stream.example.com/test.m3u8`;
      const { channels } = parseM3U(m3u);
      expect(channels[0].group).toBe('Sports');
    });
  });
});
