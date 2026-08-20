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

export const buildM3uXmltvUrl = (playlistUrl: string): string | null => {
  try {
    const url = new URL(playlistUrl);
    const username = url.searchParams.get('username');
    const password = url.searchParams.get('password');
    if (!username || !password) return null;

    const directory = url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1);
    url.pathname = `${directory}xmltv.php`;
    url.search = '';
    url.searchParams.set('username', username);
    url.searchParams.set('password', password);
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
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

  if (playlist.sourceType === 'm3u') {
    const derivedUrl = buildM3uXmltvUrl(playlist.url);
    return derivedUrl ? [derivedUrl] : [];
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
