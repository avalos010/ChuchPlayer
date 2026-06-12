import React, { useEffect, useMemo } from 'react';
import {
  DeviceEventEmitter,
  Platform,
  requireNativeComponent,
  UIManager,
  ViewStyle,
} from 'react-native';
import { Channel } from '../../types';

type NativeChannelListViewProps = {
  style?: ViewStyle;
  channels: string;
  currentChannelId?: string;
  focusedChannelId?: string;
  showNumbers?: boolean;
  title?: string;
  activeTab?: string;
  searchQuery?: string;
  accentColor?: string;
  bgColor?: string;
};

export const isNativeChannelListAvailable =
  Platform.OS === 'android' &&
  typeof UIManager.getViewManagerConfig === 'function' &&
  !!UIManager.getViewManagerConfig('ChannelListView');

const NativeView = isNativeChannelListAvailable
  ? requireNativeComponent<NativeChannelListViewProps>('ChannelListView')
  : null;

interface NativeChannelListProps {
  style?: ViewStyle;
  channels: Channel[];
  currentChannelId?: string;
  focusedChannelId?: string;
  showNumbers?: boolean;
  title?: string;
  activeTab?: string;
  searchQuery?: string;
  accentColor?: string;
  bgColor?: string;
  onChannelSelect: (channel: Channel) => void;
  onChannelFocus: (channelId: string) => void;
  onOpenGroups: () => void;
  onTabSelect?: (tabId: string) => void;
  onSearchPress?: () => void;
}

const NativeChannelList: React.FC<NativeChannelListProps> = ({
  style,
  channels,
  currentChannelId,
  focusedChannelId,
  showNumbers = false,
  title,
  activeTab,
  searchQuery,
  accentColor,
  bgColor,
  onChannelSelect,
  onChannelFocus,
  onOpenGroups,
  onTabSelect,
  onSearchPress,
}) => {
  const channelMap = useMemo(() => new Map(channels.map((ch) => [ch.id, ch])), [channels]);

  useEffect(() => {
    const selectSub = DeviceEventEmitter.addListener(
      'CHANNEL_LIST_SELECT',
      (event: { channelId?: string }) => {
        const channel = event.channelId ? channelMap.get(event.channelId) : null;
        if (channel) onChannelSelect(channel);
      },
    );
    const focusSub = DeviceEventEmitter.addListener(
      'CHANNEL_LIST_FOCUS',
      (event: { channelId?: string }) => {
        if (event.channelId) onChannelFocus(event.channelId);
      },
    );
    const groupsSub = DeviceEventEmitter.addListener('CHANNEL_LIST_OPEN_GROUPS', onOpenGroups);
    const tabSub = DeviceEventEmitter.addListener(
      'CHANNEL_LIST_TAB_SELECT',
      (event: { tabId?: string }) => {
        if (event.tabId) onTabSelect?.(event.tabId);
      },
    );
    const searchSub = DeviceEventEmitter.addListener('CHANNEL_LIST_SEARCH', () => onSearchPress?.());
    return () => {
      selectSub.remove();
      focusSub.remove();
      groupsSub.remove();
      tabSub.remove();
      searchSub.remove();
    };
  }, [channelMap, onChannelFocus, onChannelSelect, onOpenGroups, onSearchPress, onTabSelect]);

  const channelsJson = useMemo(
    () =>
      JSON.stringify(
        channels.map((ch, index) => ({
          id: ch.id,
          name: ch.name,
          logo: ch.logo ?? '',
          number: ch.number != null ? String(ch.number) : String(index + 1),
          catchupAvailable: ch.catchupAvailable ?? false,
        })),
      ),
    [channels],
  );

  if (!NativeView) return null;

  return (
    <NativeView
      style={style}
      channels={channelsJson}
      currentChannelId={currentChannelId ?? ''}
      focusedChannelId={focusedChannelId ?? currentChannelId ?? ''}
      showNumbers={showNumbers}
      title={title}
      activeTab={activeTab}
      searchQuery={searchQuery}
      accentColor={accentColor}
      bgColor={bgColor}
    />
  );
};

export default NativeChannelList;
