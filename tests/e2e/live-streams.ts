import type { Channel } from '../../src/types';

export const liveStreams: Channel[] = [
  {
    id: 'live-bunny-abr',
    name: 'Big Buck Bunny ABR',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    logo: 'https://fixtures.chuchplayer.local/live-bunny.svg',
    group: 'Public Test',
    tvgId: 'live.bunny.abr',
    number: 901,
  },
  {
    id: 'live-bunny-480',
    name: 'Big Buck Bunny 480p',
    url: 'https://test-streams.mux.dev/x36xhzz/url_6/193039199_mp4_h264_aac_hq_7.m3u8',
    logo: 'https://fixtures.chuchplayer.local/live-bunny-480.svg',
    group: 'Public Test',
    tvgId: 'live.bunny.480',
    number: 902,
  },
  {
    id: 'live-tears-steel',
    name: 'Tears of Steel HLS',
    url: 'https://test-streams.mux.dev/tos_ismc/main.m3u8',
    logo: 'https://fixtures.chuchplayer.local/live-tears.svg',
    group: 'Public Test',
    tvgId: 'live.tears.steel',
    number: 903,
  },
];
