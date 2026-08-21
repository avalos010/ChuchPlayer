import { getXtreamProxyUrl } from '../xtreamProxy.web';

const {
  buildProxyUrl,
  parseProxyTarget,
  rewriteHlsManifest,
} = require('../../../server/xtreamProxy');

describe('Xtream web proxy URLs', () => {
  it('wraps remote provider URLs and keeps proxy URLs stable', () => {
    const target = 'http://provider.example:8080/player_api.php?username=user&password=pa%20ss';
    const proxied = getXtreamProxyUrl(target);

    expect(proxied).toBe(`/api/xtream?url=${encodeURIComponent(target)}`);
    expect(getXtreamProxyUrl(proxied)).toBe(proxied);
    expect(parseProxyTarget(proxied)?.toString()).toBe(target);
  });

  it('does not proxy unsupported or relative URLs', () => {
    expect(getXtreamProxyUrl('/local/fixture.m3u8')).toBe('/local/fixture.m3u8');
    expect(getXtreamProxyUrl('file:///tmp/fixture.m3u8')).toBe('file:///tmp/fixture.m3u8');
    expect(parseProxyTarget('/api/xtream?url=ftp%3A%2F%2Fprovider.example%2Fguide.xml')).toBeNull();
  });
});

describe('Xtream HLS proxy rewriting', () => {
  it('rewrites variants, segments, encryption keys, and maps', () => {
    const source = 'http://provider.example/live/user/pass/master.m3u8';
    const manifest = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=800000
low/index.m3u8
#EXT-X-KEY:METHOD=AES-128,URI="keys/live.key"
#EXT-X-MAP:URI="init.mp4"
#EXTINF:6,
segment-1.ts`;

    const rewritten = rewriteHlsManifest(manifest, source);

    expect(rewritten).toContain(buildProxyUrl('http://provider.example/live/user/pass/low/index.m3u8'));
    expect(rewritten).toContain(`URI="${buildProxyUrl('http://provider.example/live/user/pass/keys/live.key')}"`);
    expect(rewritten).toContain(`URI="${buildProxyUrl('http://provider.example/live/user/pass/init.mp4')}"`);
    expect(rewritten).toContain(buildProxyUrl('http://provider.example/live/user/pass/segment-1.ts'));
  });
});
