import React, { useEffect, useMemo } from 'react';
import {
  DeviceEventEmitter,
  Platform,
  requireNativeComponent,
  UIManager,
  ViewStyle,
} from 'react-native';
import { Playlist } from '../../types';

type NativeGroupsRailViewProps = {
  style?: ViewStyle;
  groups: string;
  playlists: string;
  accentColor?: string;
  bgColor?: string;
  primaryNavigationOpen: boolean;
};

export const isNativeGroupsRailAvailable =
  Platform.OS === 'android' &&
  typeof UIManager.getViewManagerConfig === 'function' &&
  !!UIManager.getViewManagerConfig('GroupsRailView');

const NativeView = isNativeGroupsRailAvailable
  ? requireNativeComponent<NativeGroupsRailViewProps>('GroupsRailView')
  : null;

interface GroupModel {
  name: string;
  count: number;
}

interface NativeGroupsRailProps {
  style?: ViewStyle;
  groups: GroupModel[];
  playlists: Playlist[];
  selectedGroup: string | null;
  currentPlaylistId?: string;
  accentColor?: string;
  bgColor?: string;
  primaryNavigationOpen: boolean;
  onGroupSelect: (group: string | null) => void;
  onPlaylistSelect: (playlistId: string) => void;
  onClose: () => void;
  onOpenNavigation: () => void;
  onCloseNavigation: () => void;
}

const NativeGroupsRail: React.FC<NativeGroupsRailProps> = ({
  style,
  groups,
  playlists,
  selectedGroup,
  currentPlaylistId,
  accentColor,
  bgColor,
  primaryNavigationOpen,
  onGroupSelect,
  onPlaylistSelect,
  onClose,
  onOpenNavigation,
  onCloseNavigation,
}) => {
  useEffect(() => {
    const groupSub = DeviceEventEmitter.addListener(
      'GROUPS_RAIL_GROUP_SELECT',
      (event: { group?: string | null }) => onGroupSelect(event.group ?? null),
    );
    const playlistSub = DeviceEventEmitter.addListener(
      'GROUPS_RAIL_PLAYLIST_SELECT',
      (event: { playlistId?: string }) => {
        if (event.playlistId) onPlaylistSelect(event.playlistId);
      },
    );
    const closeSub = DeviceEventEmitter.addListener('GROUPS_RAIL_CLOSE', onClose);
    const navigationSub = DeviceEventEmitter.addListener('GROUPS_RAIL_OPEN_NAVIGATION', onOpenNavigation);
    const closeNavigationSub = DeviceEventEmitter.addListener('GROUPS_RAIL_CLOSE_NAVIGATION', onCloseNavigation);
    return () => {
      groupSub.remove();
      playlistSub.remove();
      closeSub.remove();
      navigationSub.remove();
      closeNavigationSub.remove();
    };
  }, [onClose, onCloseNavigation, onGroupSelect, onOpenNavigation, onPlaylistSelect]);

  const groupsJson = useMemo(
    () =>
      JSON.stringify(
        groups.map((group) => ({
          id: group.name === 'All Channels' ? '__all__' : `g-${group.name}`,
          type: 'group',
          name: group.name,
          group: group.name === 'All Channels' ? null : group.name,
          count: group.count,
          active: (group.name === 'All Channels' && !selectedGroup) || selectedGroup === group.name,
        })),
      ),
    [groups, selectedGroup],
  );

  const playlistsJson = useMemo(
    () =>
      JSON.stringify(
        playlists.map((playlist) => ({
          id: playlist.id,
          type: 'playlist',
          name: playlist.name,
          sourceType: playlist.sourceType,
          count: playlist.channels?.length ?? 0,
          active: currentPlaylistId === playlist.id,
        })),
      ),
    [currentPlaylistId, playlists],
  );

  if (!NativeView) return null;

  return (
    <NativeView
      style={style}
      groups={groupsJson}
      playlists={playlistsJson}
      accentColor={accentColor}
      bgColor={bgColor}
      primaryNavigationOpen={primaryNavigationOpen}
    />
  );
};

export default NativeGroupsRail;
