export interface Channel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  group?: string;
  tvgId?: string;
}

export interface EPGProgram {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  icon?: string;
}

export type PlaylistSourceType = 'm3u' | 'xtream';

export interface Playlist {
  id: string;
  name: string;
  url: string;
  sourceType: PlaylistSourceType;
  channels: Channel[];
  epgUrls?: string[];
  createdAt: Date;
  updatedAt: Date;
  // For Xtream Codes, store credentials separately (encrypted in the future)
  xtreamCredentials?: {
    serverUrl: string;
    username: string;
    password: string;
  };
}

export interface Settings {
  defaultPlaylist?: string;
  autoPlay: boolean;
  showEPG: boolean;
  theme: 'dark' | 'light';
  multiScreenEnabled: boolean;
  maxMultiScreens: number;
  epgRefreshIntervalMinutes: number;
  channelRefreshIntervalMinutes: number;
}

export type RootStackParamList = {
  Player: { channel?: Channel };
  Settings: undefined;
};
