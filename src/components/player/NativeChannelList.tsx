import React, { useEffect, useMemo } from 'react';
import {
  DeviceEventEmitter,
  Platform,
  requireNativeComponent,
  UIManager,
  ViewStyle,
} from 'react-native';
import { Channel, EPGProgram } from '../../types';

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
  focusTrigger?: number;
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
  focusTrigger?: number;
  getCurrentProgram?: (channelId: string) => EPGProgram | null;
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
  focusTrigger,
  getCurrentProgram,
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
        channels.map((ch, index) => {
          const prog = getCurrentProgram?.(ch.id) ?? null;
          return {
            id: ch.id,
            name: ch.name,
            logo: ch.logo ?? '',
            number: ch.number != null ? String(ch.number) : String(index + 1),
            catchupAvailable: ch.catchupAvailable ?? false,
            programTitle: prog?.title ?? '',
            programStart: prog?.start instanceof Date ? prog.start.getTime() : (prog?.start ?? 0),
            programEnd: prog?.end instanceof Date ? prog.end.getTime() : (prog?.end ?? 0),
          };
        }),
      ),
    [channels, getCurrentProgram],
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
      focusTrigger={focusTrigger ?? 0}
    />
  );
};

export default NativeChannelList;
