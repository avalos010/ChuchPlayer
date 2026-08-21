import { Channel, VodItem } from '../types';
import { getXtreamProxyUrl } from './xtreamProxy';

export interface XtreamCodesCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

export interface XtreamCodesUserInfo {
  username: string;
  password: string;
  message: string;
  auth: number;
  status: string;
  exp_date: string;
  is_trial: string;
  active_cons: string;
  created_at: string;
  max_connections: string;
  allowed_output_formats: string[];
}

export interface XtreamCodesStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string;
  added: string;
  category_id: string;
  category_ids: number[];
  custom_sid: string;
  tv_archive: number;
  direct_source: string;
  tv_archive_duration: number;
}

export interface XtreamCodesCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface XtreamCodesVodStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  rating?: string;
  rating_5based?: number;
  added?: string;
  category_id: string;
  category_ids?: number[];
  container_extension?: string;
  custom_sid?: string;
  direct_source?: string;
  plot?: string;
  releaseDate?: string;
  release_date?: string;
  duration?: string;
  backdrop_path?: string[];
}

const fetchXtreamJson = async <T>(url: string, label: string): Promise<T> => {
  const requestUrl = getXtreamProxyUrl(url);
  const response = await fetch(requestUrl);
  if (!response.ok) {
    throw new Error(`${label}. HTTP status ${response.status}`);
  }

  const body = await response.text();
  try {
    return JSON.parse(body) as T;
  } catch {
    const proxyRequest = requestUrl.startsWith('/api/xtream?');
    const proxyActive = response.headers.get('x-chuchplayer-xtream-proxy') === '1';
    if (proxyRequest && !proxyActive) {
      throw new Error('Xtream web proxy is not active. Restart the Expo web server and try again.');
    }
    if (body.trimStart().startsWith('<')) {
      throw new Error(`${label}. The provider returned HTML instead of JSON.`);
    }
    throw new Error(`${label}. The provider returned invalid JSON.`);
  }
};

/**
 * Fetches user info to validate credentials
 */
export const fetchXtreamUserInfo = async (
  credentials: XtreamCodesCredentials
): Promise<XtreamCodesUserInfo> => {
  const baseUrl = credentials.serverUrl.replace(/\/$/, '');
  const url = `${baseUrl}/player_api.php?username=${encodeURIComponent(
    credentials.username
  )}&password=${encodeURIComponent(credentials.password)}`;

  const data = await fetchXtreamJson<{ user_info?: XtreamCodesUserInfo }>(
    url,
    'Failed to authenticate',
  );
  if (!data.user_info || data.user_info.auth === 0) {
    throw new Error('Invalid credentials. Please check your username and password.');
  }

  return data.user_info;
};

/**
 * Fetches live stream categories
 */
export const fetchXtreamCategories = async (
  credentials: XtreamCodesCredentials
): Promise<XtreamCodesCategory[]> => {
  const baseUrl = credentials.serverUrl.replace(/\/$/, '');
  const url = `${baseUrl}/player_api.php?username=${encodeURIComponent(
    credentials.username
  )}&password=${encodeURIComponent(credentials.password)}&action=get_live_categories`;

  const data = await fetchXtreamJson<unknown>(url, 'Failed to fetch categories');
  return Array.isArray(data) ? data : [];
};

/**
 * Fetches all live streams
 */
export const fetchXtreamStreams = async (
  credentials: XtreamCodesCredentials
): Promise<XtreamCodesStream[]> => {
  const baseUrl = credentials.serverUrl.replace(/\/$/, '');
  const url = `${baseUrl}/player_api.php?username=${encodeURIComponent(
    credentials.username
  )}&password=${encodeURIComponent(credentials.password)}&action=get_live_streams`;

  const data = await fetchXtreamJson<unknown>(url, 'Failed to fetch streams');
  return Array.isArray(data) ? data : [];
};

const fetchXtreamAction = async <T>(
  credentials: XtreamCodesCredentials,
  action: string,
): Promise<T[]> => {
  const baseUrl = credentials.serverUrl.replace(/\/$/, '');
  const url = `${baseUrl}/player_api.php?username=${encodeURIComponent(
    credentials.username
  )}&password=${encodeURIComponent(credentials.password)}&action=${action}`;
  const data = await fetchXtreamJson<unknown>(url, `Failed to fetch ${action}`);
  return Array.isArray(data) ? data : [];
};

export const fetchXtreamVodCategories = (
  credentials: XtreamCodesCredentials,
): Promise<XtreamCodesCategory[]> => fetchXtreamAction(credentials, 'get_vod_categories');

export const fetchXtreamVodStreams = (
  credentials: XtreamCodesCredentials,
): Promise<XtreamCodesVodStream[]> => fetchXtreamAction(credentials, 'get_vod_streams');

/**
 * Builds the stream URL for a channel
 */
export const buildXtreamStreamUrl = (
  credentials: XtreamCodesCredentials,
  streamId: number | string
): string => {
  const baseUrl = credentials.serverUrl.replace(/\/$/, '');
  return `${baseUrl}/live/${encodeURIComponent(
    credentials.username
  )}/${encodeURIComponent(credentials.password)}/${streamId}.m3u8`;
};

export const buildXtreamVodUrl = (
  credentials: XtreamCodesCredentials,
  streamId: number | string,
  extension = 'mp4',
): string => {
  const baseUrl = credentials.serverUrl.replace(/\/$/, '');
  const safeExtension = extension.replace(/^\./, '') || 'mp4';
  return `${baseUrl}/movie/${encodeURIComponent(
    credentials.username
  )}/${encodeURIComponent(credentials.password)}/${streamId}.${safeExtension}`;
};

/**
 * Converts Xtream Codes streams to Channel format
 */
export const parseXtreamStreams = (
  streams: XtreamCodesStream[],
  credentials: XtreamCodesCredentials,
  categories: XtreamCodesCategory[]
): Channel[] => {
  const categoryMap = new Map<string, string>();
  
  // Guard against null/undefined categories
  if (categories && Array.isArray(categories)) {
    categories.forEach(cat => {
      if (cat) {
        categoryMap.set(cat.category_id, cat.category_name);
      }
    });
  }

  // Guard against null/undefined streams
  if (!streams || !Array.isArray(streams)) {
    return [];
  }

  const parsed: Channel[] = [];

  streams.forEach((stream, index) => {
    if (!stream) {
      return;
    }

    const categoryId = stream.category_id || stream.category_ids?.[0]?.toString() || 'Uncategorized';
    const group = categoryMap.get(categoryId) || 'Uncategorized';

    parsed.push({
      id: `xtream-${stream.stream_id || stream.num || index}`,
      name: stream.name || 'Unknown Channel',
      url: buildXtreamStreamUrl(credentials, stream.stream_id || stream.num),
      logo: stream.stream_icon || undefined,
      group: group !== 'Uncategorized' ? group : 'Uncategorized',
      tvgId: stream.epg_channel_id || stream.custom_sid || undefined,
      catchupAvailable: stream.tv_archive > 0,
    });
  });

  return parsed;
};

export const parseXtreamVodStreams = (
  streams: XtreamCodesVodStream[],
  credentials: XtreamCodesCredentials,
  categories: XtreamCodesCategory[],
): VodItem[] => {
  const categoryMap = new Map(
    (Array.isArray(categories) ? categories : [])
      .filter(Boolean)
      .map((category) => [category.category_id, category.category_name]),
  );

  if (!Array.isArray(streams)) return [];

  return streams.filter(Boolean).map((stream, index) => {
    const streamId = stream.stream_id || stream.num || index;
    const categoryId = stream.category_id || stream.category_ids?.[0]?.toString();
    const extension = stream.container_extension || 'mp4';
    return {
      id: `xtream-vod-${streamId}`,
      name: stream.name || 'Untitled',
      url: buildXtreamVodUrl(credentials, streamId, extension),
      poster: stream.stream_icon || undefined,
      backdrop: stream.backdrop_path?.[0],
      group: (categoryId && categoryMap.get(categoryId)) || 'Uncategorized',
      plot: stream.plot || undefined,
      rating: stream.rating || (stream.rating_5based != null ? String(stream.rating_5based) : undefined),
      releaseDate: stream.releaseDate || stream.release_date || undefined,
      duration: stream.duration || undefined,
      extension,
    };
  });
};

export const fetchXtreamVodCatalog = async (
  credentials: XtreamCodesCredentials,
): Promise<VodItem[]> => {
  const { NativeModules, Platform } = require('react-native');
  const nativeParser = NativeModules.PlaylistParserModule;
  if (Platform.OS === 'android') {
    if (!nativeParser?.fetchXtreamVod) {
      throw new Error('The Android VOD service is unavailable. Please install the latest app build.');
    }
    return nativeParser.fetchXtreamVod(
      credentials.serverUrl,
      credentials.username,
      credentials.password,
    );
  }
  const [categories, streams] = await Promise.all([
    fetchXtreamVodCategories(credentials).catch(() => []),
    fetchXtreamVodStreams(credentials),
  ]);
  return parseXtreamVodStreams(streams, credentials, categories);
};

/**
 * Fetches and parses all channels from Xtream Codes API
 */
export interface XtreamPlaylistData {
  channels: Channel[];
  vodItems: VodItem[];
  epgUrls: string[];
}

const buildXmltvUrl = (credentials: XtreamCodesCredentials): string => {
  const baseUrl = credentials.serverUrl.replace(/\/$/, '');
  return `${baseUrl}/xmltv.php?username=${encodeURIComponent(
    credentials.username
  )}&password=${encodeURIComponent(credentials.password)}`;
};

export const fetchXtreamPlaylist = async (
  credentials: XtreamCodesCredentials
): Promise<XtreamPlaylistData> => {
  // Validate credentials first
  await fetchXtreamUserInfo(credentials);

  // Fetch categories and streams in parallel
  const [categories, streams, vodItems] = await Promise.all([
    fetchXtreamCategories(credentials),
    fetchXtreamStreams(credentials),
    fetchXtreamVodCatalog(credentials).catch((error) => {
      console.warn('[VOD] Catalog refresh failed:', error);
      return [];
    }),
  ]);

  if (streams.length === 0) {
    throw new Error('No valid channels found in the Xtream Codes account.');
  }

  const channels = parseXtreamStreams(streams, credentials, categories);
  const epgUrl = buildXmltvUrl(credentials);

  return {
    channels,
    vodItems,
    epgUrls: [epgUrl],
  };
};
