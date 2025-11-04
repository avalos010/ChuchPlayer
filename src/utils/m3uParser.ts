import { Channel } from '../types';

export const parseM3U = (content: string): Channel[] => {
  const channels: Channel[] = [];
  const lines = content.split('\n').map(line => line.trim());

  let currentChannel: Partial<Channel> = {};
  let channelIndex = 0;

  for (const line of lines) {
    if (!line || line === '#EXTM3U') {
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
      const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
      const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
      const groupTitleMatch = line.match(/group-title="([^"]*)"/);

      const nameMatch = line.match(/,(.+)$/);
      const channelName = nameMatch ? nameMatch[1].trim() : 'Unknown Channel';

      const uniqueId = tvgIdMatch && tvgIdMatch[1]
        ? tvgIdMatch[1]
        : `channel-${Date.now()}-${channelIndex++}`;

      currentChannel = {
        id: uniqueId,
        name: tvgNameMatch && tvgNameMatch[1] ? tvgNameMatch[1] : channelName,
        logo: tvgLogoMatch && tvgLogoMatch[1] ? tvgLogoMatch[1] : undefined,
        group: groupTitleMatch && groupTitleMatch[1] ? groupTitleMatch[1] : 'Uncategorized',
        tvgId: tvgIdMatch && tvgIdMatch[1] ? tvgIdMatch[1] : undefined,
      };

      continue;
    }

    if (
      line.startsWith('http://') ||
      line.startsWith('https://') ||
      line.startsWith('rtmp://')
    ) {
      if (currentChannel.name) {
        channels.push({
          ...(currentChannel as Omit<Channel, 'url'>),
          url: line,
        });
      }
      currentChannel = {};
    }
  }

  return channels;
};

export const fetchM3UPlaylist = async (url: string): Promise<Channel[]> => {
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

  const channels = parseM3U(content);
  if (channels.length === 0) {
    throw new Error('No valid channels found in the playlist.');
  }

  return channels;
};

export const groupChannelsByCategory = (channels: Channel[]): Map<string, Channel[]> => {
  const grouped = new Map<string, Channel[]>();

  channels.forEach(channel => {
    const group = channel.group ?? 'Uncategorized';
    if (!grouped.has(group)) {
      grouped.set(group, []);
    }
    grouped.get(group)!.push(channel);
  });

  return grouped;
};
