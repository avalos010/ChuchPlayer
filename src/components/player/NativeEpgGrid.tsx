import React, { useEffect, useMemo } from 'react';
import {
  requireNativeComponent,
  ViewStyle,
  DeviceEventEmitter,
  Platform,
  UIManager,
} from 'react-native';
import { Channel } from '../../types';

type NativeEpgGridViewProps = {
  style?: ViewStyle;
  playlistId: string;
  channels: string;
  currentChannelId?: string;
  accentColor?: string;
  bgColor?: string;
  dataVersion?: number;
};

export const isNativeEpgGridAvailable =
  Platform.OS === 'android' &&
  typeof UIManager.getViewManagerConfig === 'function' &&
  !!UIManager.getViewManagerConfig('EpgGridView');

// Only require the native view when Android has actually registered it.
const NativeView = isNativeEpgGridAvailable
  ? requireNativeComponent<NativeEpgGridViewProps>('EpgGridView')
  : null;

interface Props {
  style?: ViewStyle;
  playlistId: string;
  channels: Channel[];
  currentChannelId?: string;
  accentColor?: string;
  bgColor?: string;
  dataVersion?: number;
  onChannelSelect: (channelId: string, channelName: string) => void;
  onCatchupSelect?: (channelId: string, startMs: number, endMs: number, programTitle: string) => void;
}

const NativeEpgGrid: React.FC<Props> = ({
  style,
  playlistId,
  channels,
  currentChannelId,
  accentColor,
  bgColor,
  dataVersion,
  onChannelSelect,
  onCatchupSelect,
}) => {
  useEffect(() => {
    const liveSub = DeviceEventEmitter.addListener(
      'EPG_CHANNEL_SELECT',
      (data: { channelId: string; channelName: string }) => {
        onChannelSelect(data.channelId, data.channelName);
      }
    );
    const catchupSub = DeviceEventEmitter.addListener(
      'EPG_CATCHUP_SELECT',
      (data: { channelId: string; channelName: string; startMs: number; endMs: number; programTitle: string }) => {
        onCatchupSelect?.(data.channelId, data.startMs, data.endMs, data.programTitle);
      }
    );
    return () => { liveSub.remove(); catchupSub.remove(); };
  }, [onChannelSelect, onCatchupSelect]);

  const channelsJson = useMemo(
    () =>
      JSON.stringify(
        channels.map((ch) => ({
          id: ch.id,
          name: ch.name,
          logo: ch.logo ?? '',
          tvgId: ch.tvgId ?? '',
          catchupAvailable: ch.catchupAvailable ?? false,
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
      accentColor={accentColor ?? '#ffffff'}
      bgColor={bgColor ?? '#0a0a0a'}
      dataVersion={dataVersion ?? 0}
    />
  );
};

export default NativeEpgGrid;
