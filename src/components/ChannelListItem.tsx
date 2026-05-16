import React, { useState, forwardRef, useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import FocusableItem from './FocusableItem';
import { Channel } from '../types';

interface ChannelListItemProps {
  channel: Channel;
  onPress: (channel: Channel) => void;
  onFocus?: (channelId: string) => void;
  hasTVPreferredFocus?: boolean;
  isCurrentChannel?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (channel: Channel) => void;
}

const TV = Platform.OS === 'android';

const ChannelListItemComponent = forwardRef<any, ChannelListItemProps>(({
  channel,
  onPress,
  onFocus,
  hasTVPreferredFocus = false,
  isCurrentChannel = false,
  isFavorite = false,
  onToggleFavorite,
}, ref) => {
  const [imgErr, setImgErr] = useState(false);

  const handlePress  = useCallback(() => onPress(channel), [channel, onPress]);
  const handleFocus  = useCallback(() => onFocus?.(channel.id), [channel.id, onFocus]);
  const handleStar   = useCallback(() => onToggleFavorite?.(channel), [channel, onToggleFavorite]);

  const logoSz = TV ? 68 : 56;
  const initials = channel.name.substring(0, 2).toUpperCase();

  return (
    <FocusableItem
      ref={ref}
      onPress={handlePress}
      onFocus={handleFocus}
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={[
        s.item,
        isCurrentChannel && s.itemCurrent,
      ]}
      focusedStyle={FOCUSED_STYLE}
    >
      <View style={s.inner}>
        {/* Logo / initials */}
        {channel.logo && !imgErr ? (
          <Image
            source={{ uri: channel.logo }}
            style={[s.logo, { width: logoSz, height: logoSz }]}
            contentFit="contain"
            cachePolicy="disk"
            onError={() => setImgErr(true)}
          />
        ) : (
          <View style={[s.logoFallback, { width: logoSz, height: logoSz },
            isCurrentChannel && s.logoFallbackCurrent,
          ]}>
            <Text style={[s.logoInitials, isCurrentChannel && { color: '#f5f5f5' }]}>
              {initials}
            </Text>
          </View>
        )}

        {/* Name + group */}
        <View style={s.meta}>
          <Text
            style={[s.name, isCurrentChannel && s.nameCurrent]}
            numberOfLines={1}
          >
            {channel.name}
          </Text>
          {channel.group ? (
            <Text
              style={[s.group, isCurrentChannel && s.groupCurrent]}
              numberOfLines={1}
            >
              {channel.group}
            </Text>
          ) : null}
        </View>

        {/* LIVE badge for current channel */}
        {isCurrentChannel && (
          <View style={s.liveBadge}>
            <Text style={s.liveTxt}>LIVE</Text>
          </View>
        )}

        {/* Favorite star */}
        {onToggleFavorite && (
          <FocusableItem
            onPress={handleStar}
            style={s.starBtn}
            focusedStyle={STAR_FOCUSED_STYLE}
          >
            <Text style={[s.starIcon, isFavorite && s.starIconActive]}>
              {isFavorite ? '★' : '☆'}
            </Text>
          </FocusableItem>
        )}
      </View>
    </FocusableItem>
  );
});

ChannelListItemComponent.displayName = 'ChannelListItem';

// Memoized with custom comparator to prevent re-renders on parent state change
const ChannelListItem = React.memo(ChannelListItemComponent, (prev, next) => {
  return (
    prev.channel.id === next.channel.id &&
    prev.channel.name === next.channel.name &&
    prev.channel.logo === next.channel.logo &&
    prev.isCurrentChannel === next.isCurrentChannel &&
    prev.hasTVPreferredFocus === next.hasTVPreferredFocus &&
    prev.isFavorite === next.isFavorite
  );
});

export default ChannelListItem;

// ─── Focused styles (static) ─────────────────────────────────────────────────

const STAR_FOCUSED_STYLE = {
  backgroundColor: '#1c1c00',
  borderColor: '#f5b942',
  borderWidth: 1,
  transform: [] as any[],
  elevation: 4,
};

const FOCUSED_STYLE = {
  backgroundColor: '#1c1c1c',
  borderColor: '#ffffff',
  borderWidth: 2,
  transform: [] as any[],
  elevation: 6,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.5,
  shadowRadius: 6,
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  item: {
    marginHorizontal: 10,
    marginVertical: 3,
    borderRadius: 12,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  itemCurrent: {
    backgroundColor: '#161616',
    borderColor: '#333333',
    borderLeftWidth: 3,
    borderLeftColor: '#e5e5e5',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: TV ? 16 : 14,
    paddingVertical: TV ? 14 : 11,
    gap: TV ? 14 : 12,
  },

  // Logo
  logo: {
    borderRadius: 10,
    backgroundColor: '#181818',
  },
  logoFallback: {
    borderRadius: 10,
    backgroundColor: '#181818',
    borderWidth: 1,
    borderColor: '#222222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoFallbackCurrent: {
    backgroundColor: '#1f1f1f',
    borderColor: '#333333',
  },
  logoInitials: {
    color: '#3d3d3d',
    fontSize: TV ? 20 : 17,
    fontWeight: '800',
  },

  // Text
  meta: { flex: 1 },
  name: {
    color: '#8a8a8a',
    fontSize: TV ? 17 : 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  nameCurrent: { color: '#f5f5f5' },
  group: {
    color: '#333333',
    fontSize: TV ? 13 : 11,
    fontWeight: '500',
  },
  groupCurrent: { color: '#555555' },

  // Star
  starBtn: {
    width: TV ? 36 : 30,
    height: TV ? 36 : 30,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  starIcon: { color: '#333', fontSize: TV ? 20 : 18 },
  starIconActive: { color: '#f5b942' },

  // LIVE badge
  liveBadge: {
    backgroundColor: '#e5e5e5',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveTxt: {
    color: '#0a0a0a',
    fontSize: TV ? 11 : 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
