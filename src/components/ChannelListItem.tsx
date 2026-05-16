import React, { useState, forwardRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import FocusableItem from './FocusableItem';
import { Channel } from '../types';
import { useThemeStore } from '../store/useThemeStore';
import { Theme } from '../theme/themes';

interface ChannelListItemProps {
  channel: Channel;
  onPress: (channel: Channel) => void;
  onFocus?: (channelId: string) => void;
  hasTVPreferredFocus?: boolean;
  isCurrentChannel?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (channel: Channel) => void;
  showNumbers?: boolean;
  index?: number;
}

const TV = Platform.OS === 'android';
const LOGO_SZ = TV ? 48 : 40;
const ROW_H   = TV ? 72 : 58;

const ChannelListItemComponent = forwardRef<any, ChannelListItemProps>(({
  channel,
  onPress,
  onFocus,
  hasTVPreferredFocus = false,
  isCurrentChannel = false,
  isFavorite = false,
  onToggleFavorite,
  showNumbers = false,
  index,
}, ref) => {
  const theme  = useThemeStore((s) => s.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [imgErr, setImgErr] = useState(false);

  const handlePress  = useCallback(() => onPress(channel), [channel, onPress]);
  const handleFocus  = useCallback(() => onFocus?.(channel.id), [channel.id, onFocus]);
  const handleStar   = useCallback(() => onToggleFavorite?.(channel), [channel, onToggleFavorite]);

  const initials = channel.name.substring(0, 2).toUpperCase();

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

  return (
    <FocusableItem
      ref={ref}
      onPress={handlePress}
      onFocus={handleFocus}
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={[styles.item, isCurrentChannel && styles.itemCurrent]}
      focusedStyle={focusedStyle}
    >
      <View style={styles.row}>
        {/* Channel number */}
        {showNumbers && (
          <Text style={[styles.num, isCurrentChannel && styles.numActive]}>
            {index != null ? String(index + 1).padStart(3, ' ') : '   '}
          </Text>
        )}

        {/* Logo */}
        {channel.logo && !imgErr ? (
          <Image
            source={{ uri: channel.logo }}
            style={styles.logo}
            contentFit="contain"
            cachePolicy="disk"
            onError={() => setImgErr(true)}
          />
        ) : (
          <View style={[styles.logoFallback, isCurrentChannel && styles.logoFallbackActive]}>
            <Text style={[styles.initials, isCurrentChannel && styles.initialsActive]}>
              {initials}
            </Text>
          </View>
        )}

        {/* Name + program */}
        <View style={styles.meta}>
          <Text style={[styles.name, isCurrentChannel && styles.nameActive]} numberOfLines={1}>
            {channel.name}
          </Text>
        </View>

        {/* Right: LIVE badge or star */}
        {isCurrentChannel ? (
          <View style={styles.liveBadge}>
            <Text style={styles.liveTxt}>LIVE</Text>
          </View>
        ) : onToggleFavorite ? (
          <FocusableItem
            onPress={handleStar}
            style={styles.starBtn}
            focusedStyle={starFocusedStyle}
          >
            <Text style={[styles.star, isFavorite && styles.starActive]}>
              {isFavorite ? '★' : '☆'}
            </Text>
          </FocusableItem>
        ) : null}
      </View>
    </FocusableItem>
  );
});

ChannelListItemComponent.displayName = 'ChannelListItem';

const ChannelListItem = React.memo(ChannelListItemComponent, (prev, next) =>
  prev.channel.id === next.channel.id &&
  prev.channel.name === next.channel.name &&
  prev.channel.logo === next.channel.logo &&
  prev.isCurrentChannel === next.isCurrentChannel &&
  prev.hasTVPreferredFocus === next.hasTVPreferredFocus &&
  prev.isFavorite === next.isFavorite &&
  prev.showNumbers === next.showNumbers &&
  prev.index === next.index
);

export default ChannelListItem;

function createStyles(theme: Theme) {
  return StyleSheet.create({
    item: {
      marginHorizontal: 8,
      marginVertical: 2,
      borderRadius: 8,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: 'transparent',
      borderLeftWidth: 3,
      borderLeftColor: 'transparent',
      height: ROW_H,
      justifyContent: 'center',
    },
    itemCurrent: {
      backgroundColor: theme.cardActive,
      borderColor: theme.border,
      borderLeftColor: theme.accent,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: TV ? 12 : 10,
      gap: TV ? 12 : 10,
      height: ROW_H,
    },
    num: {
      color: theme.textMuted,
      fontSize: TV ? 13 : 11,
      fontWeight: '600',
      width: 30,
      textAlign: 'right',
      fontFamily: 'monospace',
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
    logoFallbackActive: { backgroundColor: theme.cardActive, borderColor: theme.border },
    initials: { color: theme.textMuted, fontSize: TV ? 17 : 14, fontWeight: '800' },
    initialsActive: { color: theme.textSub },
    meta: { flex: 1 },
    name: {
      color: theme.textSub,
      fontSize: TV ? 16 : 14,
      fontWeight: '700',
    },
    nameActive: { color: theme.text },
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
    star: { color: theme.textMuted, fontSize: TV ? 18 : 16 },
    starActive: { color: '#f5b942' },
  });
}
