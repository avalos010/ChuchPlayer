import { SaxesParser, type SaxesTag } from 'saxes';

export interface XmltvChannel {
  id?: string;
  displayName?: string;
}

export interface XmltvProgram {
  channel: string;
  title: string;
  desc?: string;
  start: string;
  stop?: string;
}

export interface XmltvData {
  channels: XmltvChannel[];
  programs: XmltvProgram[];
}

export interface XmltvParseOptions {
  onChannel?: (channel: XmltvChannel) => void;
  onProgram?: (program: XmltvProgram) => void;
  onChunkProcessed?: () => Promise<void> | void;
}

const ISO8601_REGEX = /([0-9]{4})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})([+-][0-9]{4})?/;

const parseXmltvDate = (raw: string | undefined): string | undefined => {
  if (!raw) return undefined;
  const match = raw.match(ISO8601_REGEX);
  if (!match) return undefined;

  const [, year, month, day, hour, minute, second, offset] = match;
  const base = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  if (!offset) {
    return `${base}Z`;
  }

  const hoursOffset = offset.slice(1, 3);
  const minutesOffset = offset.slice(3, 5);
  return `${base}${offset[0]}${hoursOffset}:${minutesOffset}`;
};

export const parseXmltvStream = async (
  response: Response,
  options?: XmltvParseOptions
): Promise<XmltvData> => {
  const parser = new SaxesParser({ lowercase: true, xmlns: false });
  const decoder = new TextDecoder('utf-8');

  const channels: XmltvChannel[] = [];
  const programs: XmltvProgram[] = [];

  let currentChannel: XmltvChannel | null = null;
  let currentProgram: XmltvProgram | null = null;
  let currentText = '';
  let totalProcessed = 0;

  parser.on('opentag', (node: SaxesTag) => {
    const tag = node.name;

    if (tag === 'channel') {
      const attributes = node.attributes as Record<string, string>;
      currentChannel = {
        id: attributes?.id,
      };
    }

    if (tag === 'programme') {
      const attributes = node.attributes as Record<string, string>;
      currentProgram = {
        channel: attributes?.channel ?? '',
        title: '',
        start: parseXmltvDate(attributes?.start) ?? new Date().toISOString(),
        stop: parseXmltvDate(attributes?.stop),
      };
    }

    currentText = '';
  });

  parser.on('text', (text: string) => {
    currentText += text;
  });

  parser.on('closetag', (tag) => {
    const trimmed = currentText.trim();
    const tagName = typeof tag === 'string' ? tag : (tag as SaxesTag)?.name;

    if (currentChannel) {
      if (tagName === 'display-name') {
        currentChannel.displayName = trimmed;
      }

      if (tagName === 'channel') {
        if (options?.onChannel) {
          options.onChannel(currentChannel);
        } else {
          channels.push(currentChannel);
        }
        currentChannel = null;
      }
    }

    if (currentProgram) {
      if (tagName === 'title') {
        currentProgram.title = trimmed;
      }

      if (tagName === 'desc') {
        currentProgram.desc = trimmed;
      }

      if (tagName === 'programme') {
        if (options?.onProgram) {
          options.onProgram(currentProgram);
        } else {
          programs.push(currentProgram);
        }
        currentProgram = null;
      }
    }

    currentText = '';
  });

  parser.on('error', (error: Error) => {
    throw error;
  });

  if (!response.body) {
    const text = await response.text();
    parser.write(text);
    parser.close();
    if (options?.onChunkProcessed) {
      await options.onChunkProcessed();
    }
  } else {
    const reader = response.body.getReader();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          // Finalize the decoder for any remaining bytes
          const finalChunk = decoder.decode();
          if (finalChunk) {
            parser.write(finalChunk);
            totalProcessed += finalChunk.length;
          }
          parser.close();
          break;
        }

        // Decode chunk without streaming to avoid memory accumulation
        const decoded = decoder.decode(value, { stream: false });
        parser.write(decoded);
        totalProcessed += decoded.length;

        // Process chunk callback less frequently to reduce memory pressure
        if (options?.onChunkProcessed && totalProcessed % 100000 < decoded.length) {
          console.log(`[EPG] processed ${totalProcessed} bytes, triggering flush`);
          await options.onChunkProcessed();
        }
      }

      // Final callback after all data is processed
      if (options?.onChunkProcessed) {
        await options.onChunkProcessed();
      }
    } finally {
      // Ensure reader is always released
      try {
        reader.releaseLock();
      } catch (error) {
        console.warn('[XML Parser] Error releasing reader lock:', error);
      }
    }
  }

  return {
    channels,
    programs,
  };
};

