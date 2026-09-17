import React, { memo, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Channel } from '../../types';
import { isTvLikePlatform } from '../../utils/platform';
import { formatClockTime } from '../../utils/time';

const TV = isTvLikePlatform;

export interface FocusedInfo {
  channelId: string;
  channelName: string;
  channelNumber: number;
  programTitle?: string;
  programDesc?: string;
  programStart?: number;
  programEnd?: number;
}

export const INFO_H = TV ? 108 : 84;

const fmtAmPm = (ms?: number, clockFormat: '12h' | '24h' = '24h') =>
  formatClockTime(ms, clockFormat, { hour: 'numeric', minute: '2-digit' });

export const EpgInfoPanel = memo<{
  info: FocusedInfo | null;
  channel: Channel | null;
  channels: Channel[];
  theme: any;
  showChannelNumbers: boolean;
  clockFormat: '12h' | '24h';
}>(({ info, channel, channels, theme, showChannelNumbers, clockFormat }) => {
  const displayChannel = useMemo(() =>
    channels.find(c => c.id === (info?.channelId ?? channel?.id)) ?? channel,
    [channels, info?.channelId, channel],
  );

  const now = Date.now();
  const progStart = info?.programStart;
  const progEnd   = info?.programEnd;
  const progress  = (progStart && progEnd && progEnd > progStart)
    ? Math.min(Math.max((now - progStart) / (progEnd - progStart), 0), 1)
    : null;
  const remaining = progEnd ? Math.max(0, Math.round((progEnd - now) / 60000)) : null;

  const isLive = displayChannel?.id === channel?.id;
  const [imgErr, setImgErr] = useState(false);
  const initials = displayChannel?.name.substring(0, 2).toUpperCase() ?? '';

  useEffect(() => {
    setImgErr(false);
  }, [displayChannel?.id]);

  const panelStyles = useMemo(() => ({
    panel: {
      height: INFO_H,
      backgroundColor: '#070b12',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(148, 163, 184, 0.16)',
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: TV ? 22 : 16,
      gap: TV ? 18 : 14,
    },
    logoBox: {
      width: TV ? 72 : 56,
      height: TV ? 72 : 56,
      borderRadius: 10,
      backgroundColor: '#111827',
      borderWidth: 1,
      borderColor: 'rgba(148, 163, 184, 0.18)',
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      overflow: 'hidden' as const,
    },
    logoInitials: {
      color: '#93a4b8',
      fontSize: TV ? 18 : 14,
      fontWeight: '800' as const,
    },
  }), [theme]);

  return (
    <View style={panelStyles.panel}>
      {/* Logo */}
      <View style={panelStyles.logoBox}>
        {displayChannel?.logo && !imgErr ? (
          <Image
            source={{ uri: displayChannel.logo }}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
            cachePolicy="disk"
            onError={() => setImgErr(true)}
          />
        ) : (
          <Text style={panelStyles.logoInitials}>{initials}</Text>
        )}
      </View>

      {/* Info */}
      <View style={{ flex: 1, gap: 4 }}>
        {/* Channel number + name row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {showChannelNumbers && (info?.channelNumber ?? 0) > 0 && (
            <Text style={{ color: theme.accent, fontSize: TV ? 13 : 11, fontWeight: '800' }}>
              {info?.channelNumber}
            </Text>
          )}
          <Text style={{ color: '#dbeafe', fontSize: TV ? 14 : 12, fontWeight: '800' }} numberOfLines={1}>
            {displayChannel?.name ?? ''}
          </Text>
          {isLive && (
            <View style={{ backgroundColor: theme.accent, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
              <Text style={{ color: theme.accentText, fontSize: TV ? 10 : 8, fontWeight: '800', letterSpacing: 0.5 }}>
                LIVE
              </Text>
            </View>
          )}
        </View>

        {/* Program title */}
        <Text style={{ color: '#f8fafc', fontSize: TV ? 18 : 15, fontWeight: '900', lineHeight: TV ? 23 : 20 }} numberOfLines={1}>
          {info?.programTitle ?? 'No guide data'}
        </Text>

        {/* Time range + remaining */}
        {progStart && progEnd ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ color: '#8fb9e8', fontSize: TV ? 12 : 10, fontWeight: '700' }}>
              {fmtAmPm(progStart, clockFormat)} – {fmtAmPm(progEnd, clockFormat)}
            </Text>
            {remaining !== null && (
              <Text style={{ color: '#cbd5e1', fontSize: TV ? 12 : 10, fontWeight: '700' }}>
                {remaining} min
              </Text>
            )}
          </View>
        ) : null}

        {/* Progress bar */}
        {progress !== null && (
          <View style={{ height: 4, backgroundColor: 'rgba(148, 163, 184, 0.2)', borderRadius: 2, marginTop: 2, overflow: 'hidden' }}>
            <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: '#38bdf8', borderRadius: 2 }} />
          </View>
        )}
      </View>
    </View>
  );
});
EpgInfoPanel.displayName = 'EpgInfoPanel';
