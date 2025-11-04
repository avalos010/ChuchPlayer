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

export interface Playlist {
  id: string;
  name: string;
  url: string;
  channels: Channel[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Settings {
  defaultPlaylist?: string;
  autoPlay: boolean;
  showEPG: boolean;
  theme: 'dark' | 'light';
}

export type RootStackParamList = {
  Home: undefined;
  Channels: { playlistId: string };
  Player: { channel: Channel };
  Settings: undefined;
};
