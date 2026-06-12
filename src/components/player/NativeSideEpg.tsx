import React, { useEffect, useMemo } from 'react';
import {
  DeviceEventEmitter,
  Platform,
  requireNativeComponent,
  UIManager,
  ViewStyle,
} from 'react-native';
import { Channel, EPGProgram } from '../../types';

type NativeSideEpgViewProps = {
  style?: ViewStyle;
  channelId?: string;
  channelName?: string;
  channelLogo?: string;
  catchupAvailable?: boolean;
  programs: string;
  nowMs: number;
  clockFormat?: '12h' | '24h';
  accentColor?: string;
  bgColor?: string;
};

export const isNativeSideEpgAvailable =
  Platform.OS === 'android' &&
  typeof UIManager.getViewManagerConfig === 'function' &&
  !!UIManager.getViewManagerConfig('SideEpgView');

const NativeView = isNativeSideEpgAvailable
  ? requireNativeComponent<NativeSideEpgViewProps>('SideEpgView')
  : null;

interface NativeSideEpgProps {
  style?: ViewStyle;
  channel: Channel | null;
  programs: EPGProgram[];
  now: number;
  clockFormat: '12h' | '24h';
  accentColor?: string;
  bgColor?: string;
  onCatchupSelect?: (channelId: string, startMs: number, endMs: number, programTitle: string) => void;
  onOpenGroups?: () => void;
}

const NativeSideEpg: React.FC<NativeSideEpgProps> = ({
  style,
  channel,
  programs,
  now,
  clockFormat,
  accentColor,
  bgColor,
  onCatchupSelect,
  onOpenGroups,
}) => {
  useEffect(() => {
    const catchupSub = DeviceEventEmitter.addListener(
      'SIDE_EPG_CATCHUP_SELECT',
      (event: { channelId?: string; startMs?: number; endMs?: number; programTitle?: string }) => {
        if (!event.channelId || event.startMs == null || event.endMs == null || !event.programTitle) return;
        onCatchupSelect?.(event.channelId, event.startMs, event.endMs, event.programTitle);
      },
    );
    const groupsSub = DeviceEventEmitter.addListener('SIDE_EPG_OPEN_GROUPS', () => onOpenGroups?.());
    return () => {
      catchupSub.remove();
      groupsSub.remove();
    };
  }, [onCatchupSelect, onOpenGroups]);

  const programsJson = useMemo(
    () =>
      JSON.stringify(
        programs.map((program) => ({
          id: program.id,
          channelId: program.channelId,
          title: program.title,
          startMs: program.start.getTime(),
          endMs: program.end.getTime(),
        })),
      ),
    [programs],
  );

  if (!NativeView) return null;

  return (
    <NativeView
      style={style}
      channelId={channel?.id ?? ''}
      channelName={channel?.name ?? ''}
      channelLogo={channel?.logo ?? ''}
      catchupAvailable={channel?.catchupAvailable ?? false}
      programs={programsJson}
      nowMs={now}
      clockFormat={clockFormat}
      accentColor={accentColor}
      bgColor={bgColor}
    />
  );
};

export default NativeSideEpg;
