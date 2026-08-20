import { Channel } from '../types';

const fingerprint = (value: string): string => {
  let hash = 5381;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash, 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

export const ensureUniqueChannelIds = (channels: Channel[]): Channel[] => {
  const usedIds = new Set<string>();

  return channels.map(channel => {
    if (!usedIds.has(channel.id)) {
      usedIds.add(channel.id);
      return channel;
    }

    const candidate = `${channel.id}-${fingerprint(`${channel.url}|${channel.name}`)}`;
    let uniqueId = candidate;
    let occurrence = 2;

    while (usedIds.has(uniqueId)) {
      uniqueId = `${candidate}-${occurrence++}`;
    }

    usedIds.add(uniqueId);
    return { ...channel, id: uniqueId };
  });
};
