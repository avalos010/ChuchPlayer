import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, Animated, TouchableOpacity, Platform } from 'react-native';
import FocusableItem from '../FocusableItem';
import { Channel, Playlist } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { getPlaylists } from '../../utils/storage';
import { groupChannelsByCategory } from '../../utils/m3uParser';

interface GroupsPlaylistsPanelProps {
  onGroupSelect?: (group: string) => void;
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
  const channels = usePlayerStore((state) => state.channels);
  const playlist = usePlayerStore((state) => state.playlist);
  const setPlaylist = usePlayerStore((state) => state.setPlaylist);
  const setChannels = usePlayerStore((state) => state.setChannels);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  
  const listRef = useRef<FlatList>(null);

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
    return groupNames;
  }, [channels]);

  // Don't render anything when hidden
  if (!showGroupsPlaylists) {
    return null;
  }

  // Skeleton loader component
  const SkeletonItem = () => (
    <View className="px-6 py-4 border-b border-border bg-card">
      <View className="h-5 bg-subtle rounded mb-2" style={{ width: '60%' }} />
      <View className="h-4 bg-subtle rounded" style={{ width: '40%' }} />
    </View>
  );

  const handleGroupPress = (group: string) => {
    // Filter channels by group and show channel list
    const filteredChannels = channels.filter(ch => ch.group === group);
    setChannels(filteredChannels);
    setShowGroupsPlaylists(false);
    setShowChannelList(true);
    onGroupSelect?.(group);
  };

  const handlePlaylistPress = async (selectedPlaylist: Playlist) => {
    // Load the selected playlist
    setPlaylist(selectedPlaylist);
    setChannels(selectedPlaylist.channels);
    setShowGroupsPlaylists(false);
    setShowChannelList(true);
    onPlaylistSelect?.(selectedPlaylist);
  };

  return (
    <>
      {/* Dark overlay - TiviMate Style */}
      <TouchableOpacity
        className="absolute inset-0 bg-darker/85 z-[25]"
        style={{ 
          elevation: 25,
        }}
        activeOpacity={1}
        onPress={() => setShowGroupsPlaylists(false)}
      />

      {/* Panel - TiviMate Style */}
      <View
        className="absolute top-0 left-0 bottom-0 w-[420px] border-r border-border bg-card shadow-xl z-[30]"
        style={{
          elevation: 30,
          zIndex: 30,
          backgroundColor: '#161b22',
        }}
      >
        {/* Header - TiviMate Style */}
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
          <View className="flex-1">
            <View className="px-6 py-3 bg-subtle border-b border-border">
              <View className="h-4 bg-dark rounded" style={{ width: '30%' }} />
            </View>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonItem key={`skeleton-${i}`} />
            ))}
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={[
              { type: 'section', title: 'Groups', id: 'groups-header' },
              ...groups.map(g => ({ type: 'group', name: g, id: `group-${g}` })),
              { type: 'section', title: 'Playlists', id: 'playlists-header' },
              ...playlists.map(p => ({ type: 'playlist', playlist: p, id: `playlist-${p.id}` })),
            ]}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
            if (item.type === 'section') {
              return (
                <View className="px-6 py-3 bg-subtle border-b border-border">
                  <Text className="text-text-secondary text-sm font-semibold uppercase tracking-wide">
                    {item.title}
                  </Text>
                </View>
              );
            }

            if (item.type === 'group') {
              const groupName = item.name;
              const isCurrentPlaylistGroup = playlist && channels.some(ch => ch.group === groupName);
              
              return (
                <FocusableItem
                  onPress={() => handleGroupPress(groupName)}
                  className={`px-6 py-4 border-b border-border ${isCurrentPlaylistGroup ? 'bg-accent/10' : 'bg-card'}`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-text-primary text-base font-semibold">
                        {groupName}
                      </Text>
                      <Text className="text-text-muted text-sm mt-1">
                        {channels.filter(ch => ch.group === groupName).length} channels
                      </Text>
                    </View>
                    <Text className="text-accent text-lg">
                      →
                    </Text>
                  </View>
                </FocusableItem>
              );
            }

            if (item.type === 'playlist') {
              const selectedPlaylist = item.playlist;
              const isCurrentPlaylist = playlist?.id === selectedPlaylist.id;
              
              return (
                <FocusableItem
                  onPress={() => handlePlaylistPress(selectedPlaylist)}
                  className={`px-6 py-4 border-b border-border ${isCurrentPlaylist ? 'bg-accent/10' : 'bg-card'}`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-text-primary text-base font-semibold">
                        {selectedPlaylist.name}
                      </Text>
                      <Text className="text-text-muted text-sm mt-1">
                        {selectedPlaylist.channels.length} channels • {selectedPlaylist.sourceType.toUpperCase()}
                      </Text>
                    </View>
                    <Text className="text-accent text-lg">
                      →
                    </Text>
                  </View>
                </FocusableItem>
              );
            }

            return null;
            }}
            contentContainerStyle={{ paddingVertical: 0 }}
            initialNumToRender={20}
            removeClippedSubviews={true}
          />
        )}
      </View>
    </>
  );
};

export default GroupsPlaylistsPanel;

