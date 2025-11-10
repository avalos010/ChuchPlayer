import { Channel, EPGProgram } from '../types';

const HOURS_BEFORE = 12;
const HOURS_AFTER = 36;

type ChannelIndexEntry = {
  channel: Channel;
  priority: number;
};

const normalizeKeyVariants = (value: string): string[] => {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }
  const lower = trimmed.toLowerCase();
  const sanitized = lower.replace(/[^a-z0-9]/g, '');
  if (sanitized && sanitized !== lower) {
    return [lower, sanitized];
  }
  return [lower];
};

const buildChannelIndex = (channels: Channel[]): Map<string, ChannelIndexEntry> => {
  const index = new Map<string, ChannelIndexEntry>();

  const register = (key: string | undefined, priority: number, channel: Channel) => {
    if (!key) return;
    normalizeKeyVariants(key).forEach(variant => {
      const existing = index.get(variant);
      if (!existing || priority < existing.priority) {
        index.set(variant, { channel, priority });
      }
    });
  };

  channels.forEach(channel => {
    register(channel.tvgId, 1, channel);
    register(channel.id, 2, channel);
    if (!channel.tvgId) {
      register(channel.name, 3, channel);
    }
  });

  return index;
};

const resolveChannel = (
  epgChannelId: string,
  channelIndex: Map<string, ChannelIndexEntry>
): Channel | undefined => {
  for (const variant of normalizeKeyVariants(epgChannelId)) {
    const entry = channelIndex.get(variant);
    if (entry) {
      return entry.channel;
    }
  }
  return undefined;
};

const decodeXmlEntities = (value: string): string =>
  value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#34;/g, '"')
    .replace(/&#38;/g, '&');

const cleanXmlValue = (value?: string): string | undefined => {
  if (!value) return undefined;
  const cleaned = decodeXmlEntities(value).trim();
  return cleaned.length > 0 ? cleaned : undefined;
};

const extractAttributes = (attributeString: string): Record<string, string> => {
  const attributes: Record<string, string> = {};
  const attrRegex = /([\w:-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(attributeString)) !== null) {
    const key = match[1].toLowerCase();
    attributes[key] = match[2];
  }
  return attributes;
};

const extractTagContent = (xml: string, tag: string): string | undefined => {
  const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : undefined;
};

const extractIconSrc = (xml: string): string | undefined => {
  const iconMatch = xml.match(/<icon\s+[^>]*src="([^"]+)"[^>]*\/?>/i);
  return iconMatch ? iconMatch[1] : undefined;
};

const formatTimezone = (timezone?: string): string => {
  if (!timezone) return 'Z';
  if (timezone === 'Z' || timezone === '+0000' || timezone === '-0000') return 'Z';
  const match = timezone.match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!match) return 'Z';
  const [, sign, hours, minutes] = match;
  return `${sign}${hours}:${minutes}`;
};

const parseXmltvDate = (value?: string): Date | null => {
  if (!value) return null;
  const trimmed = value.trim();
  const match = trimmed.match(
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s?([+-]\d{4}|[+-]\d{2}:\d{2}|Z))?/
  );
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute, second, timezone] = match;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}${formatTimezone(timezone)}`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

const filterProgramWindow = (start: Date, end: Date): boolean => {
  const now = new Date();
  const lowerBound = new Date(now.getTime() - HOURS_BEFORE * 60 * 60 * 1000);
  const upperBound = new Date(now.getTime() + HOURS_AFTER * 60 * 60 * 1000);
  return !(end < lowerBound || start > upperBound);
};

export const parseXmltvToPrograms = (
  xml: string,
  channels: Channel[]
): Record<string, EPGProgram[]> => {
  const programsByChannel: Record<string, EPGProgram[]> = {};
  const channelIndex = buildChannelIndex(channels);

  const programmeRegex = /<programme([^>]*)>([\s\S]*?)<\/programme>/gi;
  let match: RegExpExecArray | null;

  while ((match = programmeRegex.exec(xml)) !== null) {
    const attributes = extractAttributes(match[1]);
    const epgChannelId = attributes.channel;
    if (!epgChannelId) continue;

    const channel = resolveChannel(epgChannelId, channelIndex);
    if (!channel) continue;

    const startDate = parseXmltvDate(attributes.start);
    if (!startDate) continue;
    const endDate =
      parseXmltvDate(attributes.stop) || new Date(startDate.getTime() + 60 * 60 * 1000);

    if (!filterProgramWindow(startDate, endDate)) continue;

    const titleRaw = extractTagContent(match[2], 'title');
    const descRaw = extractTagContent(match[2], 'desc');
    const iconRaw = extractIconSrc(match[2]);

    const title = cleanXmlValue(titleRaw) || 'Programme';
    const description = cleanXmlValue(descRaw);
    const icon = cleanXmlValue(iconRaw);

    const program: EPGProgram = {
      id: `epg-${channel.id}-${startDate.getTime()}`,
      channelId: channel.id,
      title,
      description,
      start: startDate,
      end: endDate,
      icon: icon || undefined,
    };

    if (!programsByChannel[channel.id]) {
      programsByChannel[channel.id] = [];
    }
    programsByChannel[channel.id].push(program);
  }

  Object.keys(programsByChannel).forEach(channelId => {
    const dedup = new Map<string, EPGProgram>();
    programsByChannel[channelId].forEach(program => {
      const dedupKey = `${program.start.getTime()}-${program.end.getTime()}-${program.title.toLowerCase()}`;
      if (!dedup.has(dedupKey)) {
        dedup.set(dedupKey, program);
      }
    });
    programsByChannel[channelId] = Array.from(dedup.values()).sort(
      (a, b) => a.start.getTime() - b.start.getTime()
    );
  });

  return programsByChannel;
};


