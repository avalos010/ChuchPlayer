import { Channel, VodItem } from '../types';
import { ensureUniqueChannelIds } from './channelIds';

export interface ParsedM3UPlaylist {
  channels: Channel[];
  vodItems: VodItem[];
  epgUrls: string[];
}

const VOD_URL_PATTERN = /\/(movie|vod)\/|\.(mp4|mkv|avi|mov|wmv)(?:\?|$)/i;

const splitPotentialUrlList = (value: string): string[] => {
  return value
    .split(/[\s,|]+/)
    .map(item => item.trim())
    .filter(item => item.length > 0)
    .map(item => {
      // Some playlists omit protocol but start with //
      if (item.startsWith('//')) {
        return `https:${item}`;
      }
      return item;
    });
};

export const parseM3U = (content: string): ParsedM3UPlaylist => {
  const channels: Channel[] = [];
  const vodItems: VodItem[] = [];
  const epgUrlSet = new Set<string>();
  const lines = content.split('\n').map(line => line.trim());

  let currentChannel: Partial<Channel> = {};
  let channelIndex = 0;

  for (const line of lines) {
    if (!line) {
      continue;
    }

    if (line.startsWith('#EXTM3U')) {
      const urlTvgMatch = line.match(/url-tvg="([^"]*)"/i);
      const tvgUrlMatch = line.match(/tvg-url="([^"]*)"/i);
      const epgUrlsRaw: string[] = [];

      if (urlTvgMatch && urlTvgMatch[1]) {
        epgUrlsRaw.push(...splitPotentialUrlList(urlTvgMatch[1]));
      }

      if (tvgUrlMatch && tvgUrlMatch[1]) {
        epgUrlsRaw.push(...splitPotentialUrlList(tvgUrlMatch[1]));
      }

      epgUrlsRaw.forEach(urlCandidate => {
        if (urlCandidate) {
          epgUrlSet.add(urlCandidate);
        }
      });
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/i);
      const tvgNameMatch = line.match(/tvg-name="([^"]*)"/i);
      const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/i);
      const groupTitleMatch = line.match(/group-title="([^"]*)"/i);

      const nameMatch = line.match(/,(.+)$/);
      const channelName = nameMatch ? nameMatch[1].trim() : 'Unknown Channel';

      const tvgId = tvgIdMatch && tvgIdMatch[1] ? tvgIdMatch[1].trim() : '';

      const uniqueId = tvgId
        ? tvgId
        : `channel-${Date.now()}-${channelIndex++}`;

      // Parse and clean group title
      let group = 'Uncategorized';
      if (groupTitleMatch && groupTitleMatch[1]) {
        const rawGroup = groupTitleMatch[1].trim();
        if (rawGroup && rawGroup.toLowerCase() !== 'undefined') {
          // If group-title has multiple values separated by semicolon, take the first one
          const firstGroup = rawGroup.split(';')[0].trim();
          if (firstGroup) {
            group = firstGroup;
          }
        }
      }

      currentChannel = {
        id: uniqueId,
        name: tvgNameMatch && tvgNameMatch[1] ? tvgNameMatch[1].trim() : channelName,
        logo: tvgLogoMatch && tvgLogoMatch[1] ? tvgLogoMatch[1].trim() : undefined,
        group,
        tvgId: tvgId || undefined,
      };

      continue;
    }

    if (
      line.startsWith('http://') ||
      line.startsWith('https://') ||
      line.startsWith('rtmp://')
    ) {
      if (currentChannel.name) {
        const item = { ...(currentChannel as Omit<Channel, 'url'>), url: line };
        if (VOD_URL_PATTERN.test(line)) {
          vodItems.push({
            id: `m3u-vod-${item.id}-${vodItems.length}`,
            name: item.name,
            url: item.url,
            poster: item.logo,
            group: item.group,
            extension: line.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1],
          });
        } else {
          channels.push(item);
        }
      }
      currentChannel = {};
    }
  }

  return {
    channels: ensureUniqueChannelIds(channels),
    vodItems,
    epgUrls: Array.from(epgUrlSet),
  };
};

export const fetchM3UPlaylist = async (url: string): Promise<ParsedM3UPlaylist> => {
  if (url.startsWith('file://')) {
    throw new Error('Local file support is not yet implemented. Please use a valid URL.');
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch playlist. HTTP status ${response.status}`);
  }

  const content = await response.text();
  if (!content.trim()) {
    throw new Error('Playlist appears to be empty.');
  }

  const { channels, vodItems, epgUrls } = parseM3U(content);
  if (channels.length === 0 && vodItems.length === 0) {
    throw new Error('No valid channels or VOD titles found in the playlist.');
  }

  return {
    channels,
    vodItems,
    epgUrls,
  };
};

export const groupChannelsByCategory = (channels: Channel[]): Map<string, Channel[]> => {
  const grouped = new Map<string, Channel[]>();

  // Guard against null/undefined channels
  if (!channels || !Array.isArray(channels)) {
    return grouped;
  }

  channels.forEach(channel => {
    // Skip null/undefined channels
    if (!channel) return;
    
    // Clean and normalize the group name
    let group = channel.group ?? 'Uncategorized';
    
    // Filter out undefined/null/empty values
    if (!group || group.trim() === '' || group.toLowerCase() === 'undefined') {
      group = 'Uncategorized';
    } else {
      // If it still has semicolons (shouldn't happen after parser fix, but just in case)
      group = group.split(';')[0].trim();
    }

    if (!grouped.has(group)) {
      grouped.set(group, []);
    }
    grouped.get(group)!.push(channel);
  });

  return grouped;
};
