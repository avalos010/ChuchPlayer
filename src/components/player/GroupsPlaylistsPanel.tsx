import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Platform } from 'react-native';
import FocusableItem from '../FocusableItem';
import { Channel, Playlist } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { getPlaylists } from '../../utils/storage';
import { groupChannelsByCategory } from '../../utils/m3uParser';

interface GroupsPlaylistsPanelProps {
  onGroupSelect?: (group: string | null) => void;
  onPlaylistSelect?: (playlist: Playlist) => void;
}

const GroupsPlaylistsPanel: React.FC<GroupsPlaylistsPanelProps> = ({
  onGroupSelect,
  onPlaylistSelect,
}) => {
  // UI state
  const showGroupsPlaylists = useUIStore((state) => state.showGroupsPlaylists);
  const setShowGroupsPlaylists = useUIStore((state) => state.setShowGroupsPlaylists);
  const setShowChannelList = useUIStore((state) => state.setShowChannelList);
  const selectedGroup = useUIStore((state) => state.selectedGroup);
  const setSelectedGroup = useUIStore((state) => state.setSelectedGroup);
  const channels = usePlayerStore((state) => state.channels);
  const playlist = usePlayerStore((state) => state.playlist);
  const setPlaylist = usePlayerStore((state) => state.setPlaylist);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const hasSetInitialFocusRef = useRef(false);
  
  const listRef = useRef<FlatList<any>>(null);

  // Load playlists on mount
  useEffect(() => {
    const loadPlaylists = async () => {
      setLoadingPlaylists(true);
      try {
        const allPlaylists = await getPlaylists();
        setPlaylists(allPlaylists);
      } catch (error) {
        console.error('Error loading playlists:', error);
      } finally {
        setLoadingPlaylists(false);
      }
    };
    loadPlaylists();
  }, []);

  // Get groups from current playlist channels
  const groups = useMemo(() => {
    if (!channels || channels.length === 0) return [];
    const grouped = groupChannelsByCategory(channels);
    const groupNames = Array.from(grouped.keys()).sort();
    return ['All Channels', ...groupNames];
  }, [channels]);

  useEffect(() => {
    if (!showGroupsPlaylists) {
      hasSetInitialFocusRef.current = false;
    }
  }, [showGroupsPlaylists]);

  // Don't render anything when hidden
  if (!showGroupsPlaylists) {
    return null;
  }

  // Skeleton loader component
  const SkeletonItem = () => (
    <View className="mx-3 my-1 px-5 py-4 rounded-xl border border-border bg-card">
      <View className="h-5 bg-subtle rounded mb-2" style={{ width: '65%' }} />
      <View className="h-4 bg-subtle rounded" style={{ width: '45%' }} />
    </View>
  );

  const handleGroupPress = (group: string | null) => {
    setSelectedGroup(group);
    setShowGroupsPlaylists(false);
    setShowChannelList(true);
    onGroupSelect?.(group);
  };

  const handlePlaylistPress = async (selectedPlaylist: Playlist) => {
    setPlaylist(selectedPlaylist);
    setSelectedGroup(null);
    setShowGroupsPlaylists(false);
    setShowChannelList(true);
    onPlaylistSelect?.(selectedPlaylist);
  };

  const keyExtractor = (item: Channel) => item.id;
  const renderChannelItem = ({ item }: { item: Channel }) => (
    <FocusableItem
      onPress={() => {
        // This onPress is for the channel item itself, not the group/playlist
        // The group/playlist selection is handled by handleGroupPress/handlePlaylistPress
      }}
      className="px-6 py-4 border-b border-border bg-card"
      focusedStyle={{
        backgroundColor: 'rgba(0, 170, 255, 0.25)',
        borderColor: '#00aaff',
        borderWidth: 2,
      }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-base font-semibold text-text-primary">{item.name}</Text>
          <Text className="text-text-muted text-sm mt-1">{item.group}</Text>
        </View>
        <Text className="text-accent text-lg">→</Text>
      </View>
    </FocusableItem>
  );

  return (
    <>
      {/* Dark overlay - TiviMate Style */}
      <TouchableOpacity
        className="absolute inset-0 bg-black/70 z-[15]"
        style={{ elevation: 15 }}
        activeOpacity={1}
        onPress={() => setShowGroupsPlaylists(false)}
      />

      {/* Panel - TiviMate Style */}
      <View
        className="absolute top-0 left-0 bottom-0 w-[420px] border-r border-border bg-card shadow-xl z-[20]"
        style={{ elevation: 20, backgroundColor: '#161b22' }}
      >
        <View className="flex-row justify-between items-center px-6 py-5 border-b border-border bg-dark">
          <View>
            <Text className="text-text-primary text-[24px] font-bold tracking-tight">
              Groups & Playlists
            </Text>
            <Text className="text-text-muted text-sm mt-1">
              {groups.length} groups, {playlists.length} playlists
            </Text>
          </View>
          <FocusableItem 
            onPress={() => setShowGroupsPlaylists(false)} 
            className="w-11 h-11 rounded-full bg-subtle border border-border justify-center items-center"
          >
            <Text className="text-text-secondary text-lg font-bold">
              ✕
            </Text>
          </FocusableItem>
        </View>

        {/* Content */}
        {loadingPlaylists ? (
          <View className="flex-1 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonItem key={`skeleton-${i}`} />
            ))}
          </View>
        ) : (
          <View className="flex-1">
            <FlatList
              ref={listRef}
              data={[
                { type: 'section', title: 'Groups', id: 'groups-header' },
                ...groups.map(g => ({ type: 'group', name: g, id: `group-${g}` })),
                { type: 'section', title: 'Playlists', id: 'playlists-header' },
                ...playlists.map(p => ({ type: 'playlist', playlist: p, id: `playlist-${p.id}` })),
              ]}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => {
              if (item.type === 'section') {
                return (
                  <View className="px-6 py-2 bg-subtle/90 border-b border-border">
                    <Text className="text-text-secondary text-xs font-semibold uppercase tracking-[0.12em]">
                      {item.title}
                    </Text>
                  </View>
                );
              }

              if (item.type === 'group') {
                const groupName = item.name;
                const isAll = groupName === 'All Channels';
                const isCurrentGroup = (isAll && !selectedGroup) || selectedGroup === groupName;
                const shouldPreferFocus = !hasSetInitialFocusRef.current && index === 1;
                
                return (
                  <FocusableItem
                    onPress={() => handleGroupPress(isAll ? null : groupName)}
                    className={`mx-1.5 my-1 px-5 py-4 rounded-2xl border border-border bg-card`}
                    focusedStyle={{
                      backgroundColor: 'rgba(11, 132, 189, 0.22)',
                      borderColor: '#00aaff',
                    }}
                    style={{
                      marginHorizontal: 12,
                      paddingHorizontal: 16,
                    }}
                    hasTVPreferredFocus={shouldPreferFocus}
                    onFocus={() => {
                      if (!hasSetInitialFocusRef.current) {
                        hasSetInitialFocusRef.current = true;
                      }
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 pr-3">
                        <Text className={`text-[16px] font-semibold ${isCurrentGroup ? 'text-white' : 'text-text-primary'}`}>
                          {groupName}
                        </Text>
                        <Text className={`${isCurrentGroup ? 'text-white/70' : 'text-text-muted'} text-[13px] mt-1`}>
                          {isAll ? `${channels.length} channels` : `${channels.filter(ch => ch.group === groupName).length} channels`}
                        </Text>
                      </View>
                      {isCurrentGroup && (
                        <View className="px-2 py-1 rounded-full bg-accent/35 border border-accent">
                          <Text className="text-white text-[10px] font-bold">ACTIVE</Text>
                        </View>
                      )}
                    </View>
                  </FocusableItem>
                );
              }

              if (item.type === 'playlist') {
                const selectedPlaylist = item.playlist;
                const isCurrentPlaylist = playlist?.id === selectedPlaylist.id;
                const firstPlaylistIndex = groups.length + 2; // sections + groups
                const shouldPreferFocus = !hasSetInitialFocusRef.current && index === firstPlaylistIndex;
                
                return (
                  <FocusableItem
                    onPress={() => handlePlaylistPress(selectedPlaylist)}
                    className={`mx-1.5 my-1 px-5 py-4 rounded-2xl border border-border bg-card`}
                    focusedStyle={{
                      backgroundColor: 'rgba(11, 132, 189, 0.22)',
                      borderColor: '#00aaff',
                    }}
                    style={{
                      marginHorizontal: 12,
                      paddingHorizontal: 16,
                    }}
                    hasTVPreferredFocus={shouldPreferFocus}
                    onFocus={() => {
                      if (!hasSetInitialFocusRef.current) {
                        hasSetInitialFocusRef.current = true;
                      }
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 pr-3">
                        <Text className={`text-[16px] font-semibold ${isCurrentPlaylist ? 'text-white' : 'text-text-primary'}`}>
                          {selectedPlaylist.name}
                        </Text>
                        <Text className={`${isCurrentPlaylist ? 'text-white/70' : 'text-text-muted'} text-[13px] mt-1`}>
                          {selectedPlaylist.channels.length} channels • {selectedPlaylist.sourceType.toUpperCase()}
                        </Text>
                      </View>
                      {isCurrentPlaylist && (
                        <View className="px-2 py-1 rounded-full bg-accent/35 border border-accent">
                          <Text className="text-white text-[10px] font-bold">ACTIVE</Text>
                        </View>
                      )}
                    </View>
                  </FocusableItem>
                );
              }

              return null;
              }}
              contentContainerStyle={{ paddingVertical: 12 }}
              initialNumToRender={20}
              removeClippedSubviews
            />
          </View>
        )}
      </View>
    </>
  );
};

export default GroupsPlaylistsPanel;

