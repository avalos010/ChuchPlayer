import React, { useEffect, useMemo } from 'react';
import { requireNativeComponent, ViewStyle, DeviceEventEmitter, Platform } from 'react-native';
import { Channel } from '../../types';

// Only require the native view on Android — requireNativeComponent throws on web/iOS
const NativeView =
  Platform.OS === 'android'
    ? requireNativeComponent<{
        style?: ViewStyle;
        playlistId: string;
        channels: string;
        currentChannelId?: string;
      }>('EpgGridView')
    : null;

interface Props {
  style?: ViewStyle;
  playlistId: string;
  channels: Channel[];
  currentChannelId?: string;
  onChannelSelect: (channelId: string, channelName: string) => void;
}

const NativeEpgGrid: React.FC<Props> = ({
  style,
  playlistId,
  channels,
  currentChannelId,
  onChannelSelect,
}) => {
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      'EPG_CHANNEL_SELECT',
      (data: { channelId: string; channelName: string }) => {
        onChannelSelect(data.channelId, data.channelName);
      }
    );
    return () => sub.remove();
  }, [onChannelSelect]);

  const channelsJson = useMemo(
    () =>
      JSON.stringify(
        channels.map((ch) => ({
          id: ch.id,
          name: ch.name,
          logo: ch.logo ?? '',
          tvgId: ch.tvgId ?? '',
        }))
      ),
    [channels]
  );

  if (!NativeView) return null;

  return (
    <NativeView
      style={style}
      playlistId={playlistId}
      channels={channelsJson}
      currentChannelId={currentChannelId ?? ''}
    />
  );
};

export default NativeEpgGrid;
