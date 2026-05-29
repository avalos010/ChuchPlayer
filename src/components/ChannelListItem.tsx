import React, { useState, forwardRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import FocusableItem from './FocusableItem';
import { Channel, EPGProgram } from '../types';
import { useThemeStore } from '../store/useThemeStore';
import { Theme } from '../theme/themes';
import { isTvLikePlatform } from '../utils/platform';
import { formatClockTime } from '../utils/time';

interface ChannelListItemProps {
  channel: Channel;
  onPress: (channel: Channel) => void;
  onFocus?: (channelId: string) => void;
  hasTVPreferredFocus?: boolean;
  isCurrentChannel?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (channel: Channel) => void;
  showNumbers?: boolean;
  clockFormat?: '12h' | '24h';
  index?: number;
  currentProgram?: EPGProgram | null;
}

const TV = isTvLikePlatform;
const LOGO_SZ = TV ? 46 : 38;
const ROW_H   = TV ? 76 : 62;

const ChannelListItemComponent = forwardRef<any, ChannelListItemProps>(({
  channel,
  onPress,
  onFocus,
  hasTVPreferredFocus = false,
  isCurrentChannel = false,
  isFavorite = false,
  onToggleFavorite,
  showNumbers = false,
  clockFormat = '24h',
  index,
  currentProgram,
}, ref) => {
  const theme = useThemeStore((s) => s.theme);
  const s = useMemo(() => createStyles(theme), [theme]);
  const [imgErr, setImgErr] = useState(false);

  const handlePress = useCallback(() => onPress(channel),          [channel, onPress]);
  const handleFocus = useCallback(() => onFocus?.(channel.id),     [channel.id, onFocus]);
  const handleStar  = useCallback(() => onToggleFavorite?.(channel),[channel, onToggleFavorite]);

  const initials = channel.name.substring(0, 2).toUpperCase();

  // Progress through current program (0–1)
  const progress = useMemo(() => {
    if (!currentProgram) return 0;
    const now = Date.now();
    const s = currentProgram.start.getTime();
    const e = currentProgram.end.getTime();
    return Math.min(1, Math.max(0, (now - s) / (e - s)));
  }, [currentProgram]);

  const focusedStyle = useMemo(() => ({
    backgroundColor: theme.card,
    borderColor: theme.focused,
    borderWidth: 2,
    transform: [] as any[],
    elevation: 6,
  }), [theme]);

  const starFocusedStyle = useMemo(() => ({
    backgroundColor: theme.cardActive,
    borderColor: theme.accent,
    borderWidth: 1,
    transform: [] as any[],
    elevation: 3,
  }), [theme]);

  const catchup = channel.catchupAvailable || currentProgram?.catchupAvailable;

  return (
    <FocusableItem
      ref={ref}
      onPress={handlePress}
      onFocus={handleFocus}
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={[s.item, isCurrentChannel && s.itemCurrent]}
      focusedStyle={focusedStyle}
    >
      {/* Main row */}
      <View style={s.row}>
        {/* Channel number */}
        {showNumbers && (
          <Text style={[s.num, isCurrentChannel && s.numActive]}>
            {index != null ? String(index + 1).padStart(3, ' ') : '   '}
          </Text>
        )}

        {/* Logo */}
        {channel.logo && !imgErr ? (
          <Image
            source={{ uri: channel.logo }}
            style={s.logo}
            contentFit="contain"
            cachePolicy="disk"
            onError={() => setImgErr(true)}
          />
        ) : (
          <View style={[s.logoFallback, isCurrentChannel && s.logoFallbackActive]}>
            <Text style={[s.initials, isCurrentChannel && s.initialsActive]}>{initials}</Text>
          </View>
        )}

        {/* Text block: name + program */}
        <View style={s.meta}>
          <View style={s.nameRow}>
            <Text style={[s.name, isCurrentChannel && s.nameActive]} numberOfLines={1}>
              {channel.name}
            </Text>
            {catchup && (
              <View style={s.catchupBadge}>
                <Text style={s.catchupTxt}>⏮</Text>
              </View>
            )}
          </View>
          {currentProgram ? (
            <Text style={[s.progTitle, isCurrentChannel && s.progTitleActive]} numberOfLines={1}>
              {currentProgram.title}
              {currentProgram.start ? (
                <Text style={s.progTime}>  {formatClockTime(currentProgram.start, clockFormat)}</Text>
              ) : null}
            </Text>
          ) : null}
        </View>

        {/* Right: LIVE badge or star */}
        {isCurrentChannel ? (
          <View style={s.liveBadge}>
            <Text style={s.liveTxt}>LIVE</Text>
          </View>
        ) : onToggleFavorite ? (
          <FocusableItem
            onPress={handleStar}
            style={s.starBtn}
            focusedStyle={starFocusedStyle}
          >
            <Text style={[s.star, isFavorite && s.starActive]}>
              {isFavorite ? '★' : '☆'}
            </Text>
          </FocusableItem>
        ) : null}
      </View>

      {/* Program progress bar */}
      {currentProgram && progress > 0 && (
        <View style={s.progressTrack} pointerEvents="none">
          <View style={[s.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>
      )}
    </FocusableItem>
  );
});

ChannelListItemComponent.displayName = 'ChannelListItem';

const ChannelListItem = React.memo(ChannelListItemComponent, (prev, next) =>
  prev.channel.id          === next.channel.id &&
  prev.channel.name        === next.channel.name &&
  prev.channel.logo        === next.channel.logo &&
  prev.isCurrentChannel    === next.isCurrentChannel &&
  prev.hasTVPreferredFocus === next.hasTVPreferredFocus &&
  prev.isFavorite          === next.isFavorite &&
  prev.showNumbers         === next.showNumbers &&
  prev.clockFormat         === next.clockFormat &&
  prev.index               === next.index &&
  prev.currentProgram?.id  === next.currentProgram?.id
);

export default ChannelListItem;

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (theme: Theme) => StyleSheet.create({
  item: {
    marginHorizontal: 6,
    marginVertical: 2,
    borderRadius: 10,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    minHeight: ROW_H,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemCurrent: {
    backgroundColor: theme.cardActive,
    borderColor: theme.border,
    borderLeftColor: theme.accent,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: TV ? 10 : 8,
    paddingVertical: TV ? 10 : 8,
    gap: TV ? 10 : 8,
  },
  num: {
    color: theme.textMuted,
    fontSize: TV ? 13 : 11,
    fontWeight: '600',
    width: 30,
    textAlign: 'right',
    fontFamily: TV ? 'monospace' : 'Courier',
  },
  numActive: { color: theme.textSub },
  logo: {
    width: LOGO_SZ,
    height: LOGO_SZ,
    borderRadius: 8,
    backgroundColor: theme.card,
  },
  logoFallback: {
    width: LOGO_SZ,
    height: LOGO_SZ,
    borderRadius: 8,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoFallbackActive: { backgroundColor: theme.cardActive, borderColor: theme.accent },
  initials: { color: theme.textMuted, fontSize: TV ? 16 : 13, fontWeight: '800' },
  initialsActive: { color: theme.textSub },
  meta: { flex: 1, gap: 3 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    color: theme.textSub,
    fontSize: TV ? 15 : 13,
    fontWeight: '700',
    flex: 1,
  },
  nameActive: { color: theme.text },
  progTitle: {
    color: theme.textMuted,
    fontSize: TV ? 12 : 10,
    fontWeight: '500',
  },
  progTitleActive: { color: theme.textSub },
  progTime: {
    color: theme.textMuted,
    fontSize: TV ? 11 : 9,
    fontWeight: '600',
  },
  catchupBadge: {
    backgroundColor: theme.card,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: theme.accent,
  },
  catchupTxt: {
    color: theme.accent,
    fontSize: TV ? 10 : 9,
    fontWeight: '700',
  },
  liveBadge: {
    backgroundColor: theme.live,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  liveTxt: { color: '#fff', fontSize: TV ? 10 : 9, fontWeight: '800', letterSpacing: 0.5 },
  starBtn: {
    width: TV ? 32 : 28,
    height: TV ? 32 : 28,
    borderRadius: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  star: { color: theme.textMuted, fontSize: TV ? 18 : 15 },
  starActive: { color: theme.accent },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: theme.border,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.accent,
    opacity: 0.7,
  },

});
