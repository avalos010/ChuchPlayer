import { Playlist } from '../../types';

export const buildXtreamXmltvUrl = (
  serverUrl: string,
  username: string,
  password: string,
) => {
  const baseUrl = serverUrl.replace(/\/$/, '');
  return `${baseUrl}/xmltv.php?username=${encodeURIComponent(
    username,
  )}&password=${encodeURIComponent(password)}`;
};

export const getActiveEpgUrls = (playlist: Playlist | null) => {
  if (!playlist) return [];

  const explicit =
    playlist.epgUrls && playlist.epgUrls.length > 0 ? playlist.epgUrls : [];
  if (explicit.length > 0) {
    return Array.from(new Set(explicit.map((url) => url.trim()).filter(Boolean)));
  }

  if (playlist.sourceType === 'xtream' && playlist.xtreamCredentials) {
    const { serverUrl, username, password } = playlist.xtreamCredentials;
    return [buildXtreamXmltvUrl(serverUrl, username, password)];
  }

  return [];
};

export const buildDatasetSignature = (
  playlist: Playlist | null,
  channelsSignature: string,
  activeEpgUrls: string[],
) => {
  if (!playlist) return null;

  const updatedAt =
    playlist.updatedAt instanceof Date
      ? playlist.updatedAt.getTime()
      : new Date(playlist.updatedAt).getTime();

  return `${playlist.id}:${updatedAt}:${channelsSignature}:${activeEpgUrls.join('|')}`;
};
