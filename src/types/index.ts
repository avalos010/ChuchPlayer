export interface Channel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  group?: string;
  tvgId?: string;
  number?: string | number;
}

export interface EPGProgram {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  icon?: string;
  catchupAvailable?: boolean;
  catchupUrl?: string;
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
  theme: string;
  customAccent?: string;
  customBg?: string;
  multiScreenEnabled: boolean;
  maxMultiScreens: number;
  epgRefreshIntervalMinutes: number;
  channelRefreshIntervalMinutes: number;
  // New settings
  bufferMode?: 'low_latency' | 'balanced' | 'smooth';
  hardwareDecoder?: boolean;
  infoBarTimeoutSeconds?: number;
  showChannelNumbers?: boolean;
  clockFormat?: '12h' | '24h';
  parentalPinEnabled?: boolean;
  parentalPinHash?: string;
  sleepTimerMinutes?: number;
}

export type RootStackParamList = {
  Player: { channel?: Channel };
  Settings: undefined;
};
