import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { View, ScrollView, Platform, StyleSheet, ViewStyle, Dimensions } from 'react-native';
import { FlashList, ListRenderItemInfo } from '@shopify/flash-list';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Channel, EPGProgram } from '../../types';
import { RootStackParamList } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { groupChannelsByCategory } from '../../utils/m3uParser';
import {
  EPGGridHeader,
  EPGGridGroupFilter,
  EPGGridTimeHeader,
  EPGChannelRow,
  EPGGridLoadingOverlay,
  EPGGridErrorMessage,
} from './EPGGrid';

interface EPGGridViewProps {
  getCurrentProgram: (channelId: string) => EPGProgram | null;
  getProgramsForChannel?: (channelId: string) => EPGProgram[];
  prefetchProgramsForChannels?: (channelIds: string[]) => void;
  onChannelSelect: (channel: Channel) => void;
  onExitPIP?: () => void;
  navigation?: NativeStackNavigationProp<RootStackParamList>;
  epgLoading?: boolean;
  epgError?: string | null;
  handleManualEpgRefresh?: () => void;
}

const CHANNEL_WIDTH = 200;
const HOUR_WIDTH = 100;
const ROW_HEIGHT = 80;
const HOURS_TO_SHOW = 24; // Show 24 hours from now
const VISIBLE_ROWS = 5; // Show 5 channels at a time

const EPGGridView: React.FC<EPGGridViewProps> = ({
  getCurrentProgram,
  getProgramsForChannel,
  prefetchProgramsForChannels,
  onChannelSelect,
  onExitPIP,
  navigation,
  epgLoading = false,
  epgError = null,
  handleManualEpgRefresh,
}) => {
  const showEPGGrid = useUIStore((state) => state.showEPGGrid);
  const setShowEPGGrid = useUIStore((state) => state.setShowEPGGrid);
  const channels = usePlayerStore((state) => state.channels);
  const channel = usePlayerStore((state) => state.channel);
  const playlist = usePlayerStore((state) => state.playlist);

  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [focusedChannelId, setFocusedChannelId] = useState<string | null>(null);
  const [horizontalScrollX, setHorizontalScrollX] = useState(0);
  const horizontalScrollRef = useRef<ScrollView>(null);
  const verticalScrollRef = useRef<FlashList<Channel>>(null);

  // Generate time slots
  const timeSlots = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    return Array.from({ length: HOURS_TO_SHOW }, (_, i) => {
      const hour = (currentHour + i) % 24;
      return {
        hour,
        label: `${hour.toString().padStart(2, '0')}:00`,
        isCurrent: i === 0,
      };
    });
  }, []);

  // Calculate current time position
  const currentTimePosition = useMemo(() => {
    const now = new Date();
    const minutes = now.getMinutes();
    return (minutes / 60) * HOUR_WIDTH;
  }, []);

  // Filter channels by group
  const filteredChannels = useMemo(() => {
    if (!channels || channels.length === 0) return [];
    const filtered = selectedGroup === 'All'
      ? channels
      : channels.filter(ch => ch && ch.group === selectedGroup);
    return filtered.filter(ch => ch != null);
  }, [channels, selectedGroup]);

  // Get groups
  const groups = useMemo(() => {
    if (!channels || channels.length === 0) return ['All'];
    const grouped = groupChannelsByCategory(channels);
    const groupNames = Array.from(grouped.keys()).sort();
    return ['All', ...groupNames];
  }, [channels]);

  // Get programs for a channel
  const getChannelPrograms = useCallback((channelId: string): EPGProgram[] => {
    if (!getProgramsForChannel) return [];
    return getProgramsForChannel(channelId);
  }, [getProgramsForChannel]);

  // Check if we have any programs loaded at all
  const hasAnyPrograms = useMemo(() => {
    if (!getProgramsForChannel || filteredChannels.length === 0) return false;
    // Check first few channels to see if any have programs
    return filteredChannels.slice(0, 5).some(ch => {
      const programs = getProgramsForChannel(ch.id);
      return programs && programs.length > 0;
    });
  }, [filteredChannels, getProgramsForChannel]);

  // Calculate program position and width
  const getProgramStyle = useCallback((program: EPGProgram) => {
    try {
      if (!program || !program.start || !program.end) {
        return { left: 0, width: 80 };
      }
      
      const now = new Date();
      const programStart = program.start instanceof Date ? program.start : new Date(program.start);
      const programEnd = program.end instanceof Date ? program.end : new Date(program.end);
      
      // Validate dates
      if (isNaN(programStart.getTime()) || isNaN(programEnd.getTime())) {
        return { left: 0, width: 80 };
      }
      
      // Calculate hours from current time
      const hoursFromNow = (programStart.getTime() - now.getTime()) / (1000 * 60 * 60);
      const duration = (programEnd.getTime() - programStart.getTime()) / (1000 * 60 * 60);
      
      const left = hoursFromNow * HOUR_WIDTH;
      const width = Math.max(duration * HOUR_WIDTH, 80);
      
      return {
        left: Math.max(0, left),
        width: Math.min(width, HOURS_TO_SHOW * HOUR_WIDTH), // Cap width to timeline
      };
    } catch (error) {
      console.warn('[EPG Grid] Error calculating program style:', error);
      return { left: 0, width: 80 };
    }
  }, []);

  // Check if program is currently playing
  const isProgramNow = useCallback((program: EPGProgram) => {
    try {
      if (!program || !program.start || !program.end) return false;
      
      const now = new Date();
      const programStart = program.start instanceof Date ? program.start : new Date(program.start);
      const programEnd = program.end instanceof Date ? program.end : new Date(program.end);
      
      if (isNaN(programStart.getTime()) || isNaN(programEnd.getTime())) {
        return false;
      }
      
      return programStart <= now && programEnd > now;
    } catch (error) {
      return false;
    }
  }, []);

  const handleClose = useCallback(() => {
    setShowEPGGrid(false);
    onExitPIP?.();
  }, [setShowEPGGrid, onExitPIP]);

  const handleSettings = useCallback(() => {
    setShowEPGGrid(false);
    onExitPIP?.();
    if (navigation) {
      setTimeout(() => {
        try {
          navigation.navigate('Settings');
        } catch (error) {
          console.log('Navigation not ready:', error);
        }
      }, 100);
    }
  }, [setShowEPGGrid, onExitPIP, navigation]);

  // Render channel row
  const renderChannelRow = useCallback(
    ({ item: ch }: ListRenderItemInfo<Channel>) => {
      const isCurrent = ch.id === channel?.id;
      const isFocused = ch.id === focusedChannelId;
      const programs = getChannelPrograms(ch.id);
      const currentProgram = getCurrentProgram(ch.id);

      return (
        <EPGChannelRow
          channel={ch}
          isCurrent={isCurrent}
          isFocused={isFocused}
          programs={programs}
          currentProgram={currentProgram}
          currentTimePosition={currentTimePosition}
          horizontalScrollX={horizontalScrollX}
          hoursToShow={HOURS_TO_SHOW}
          hourWidth={HOUR_WIDTH}
          rowHeight={ROW_HEIGHT}
          channelWidth={CHANNEL_WIDTH}
          onPress={() => onChannelSelect(ch)}
          onFocus={() => setFocusedChannelId(ch.id)}
          getProgramStyle={getProgramStyle}
          isProgramNow={isProgramNow}
        />
      );
    },
    [
      channel,
      focusedChannelId,
      getChannelPrograms,
      getCurrentProgram,
      getProgramStyle,
      isProgramNow,
      onChannelSelect,
      currentTimePosition,
      horizontalScrollX,
    ]
  );

  // Scroll to current time on mount
  useEffect(() => {
    if (showEPGGrid && horizontalScrollRef.current) {
      setTimeout(() => {
        horizontalScrollRef.current?.scrollTo({
          x: currentTimePosition - 50,
          animated: false,
        });
      }, 100);
    }
  }, [showEPGGrid, currentTimePosition]);

  // Content container style for FlashList
  const flashListContentStyle = useMemo<ViewStyle>(() => ({
    paddingBottom: 20,
    width: HOURS_TO_SHOW * HOUR_WIDTH,
  }), []);

  // Scroll to current channel on mount
  useEffect(() => {
    if (showEPGGrid && channel && verticalScrollRef.current && filteredChannels.length > 0) {
      const index = filteredChannels.findIndex(ch => ch.id === channel.id);
      if (index >= 0) {
        setTimeout(() => {
          try {
            verticalScrollRef.current?.scrollToIndex({
              index,
              animated: false,
              viewOffset: ROW_HEIGHT * 0.3,
            });
          } catch (error) {
            // Fallback to scrollToOffset if scrollToIndex fails
            verticalScrollRef.current?.scrollToOffset({
              offset: index * ROW_HEIGHT,
              animated: false,
            });
          }
        }, 300);
      }
    }
  }, [showEPGGrid, channel, filteredChannels]);

  // Track which channels have been requested to avoid duplicate requests
  const requestedChannelsRef = useRef<Set<string>>(new Set());
  
  // Load EPG data when grid opens - only load a small initial batch
  useEffect(() => {
    if (showEPGGrid && filteredChannels.length > 0 && prefetchProgramsForChannels) {
      // Only load first 5-8 visible channels initially for faster startup
      const initialChannelIds = filteredChannels
        .slice(0, 8)
        .map(ch => ch.id)
        .filter(id => !requestedChannelsRef.current.has(id));
      
      if (initialChannelIds.length > 0) {
        initialChannelIds.forEach(id => requestedChannelsRef.current.add(id));
        console.log('[EPG Grid Light] Loading initial EPG data for', initialChannelIds.length, 'channels');
        prefetchProgramsForChannels(initialChannelIds);
      }
    }
  }, [showEPGGrid, filteredChannels, prefetchProgramsForChannels, selectedGroup]);
  
  // Reset requested channels when group changes
  useEffect(() => {
    requestedChannelsRef.current.clear();
  }, [selectedGroup]);

  // Throttle viewable items changes to avoid too many rapid loads
  const viewableItemsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Lazy load EPG data for visible channels only
  const handleViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: Array<{ item: Channel; index: number | null }> }) => {
    try {
      if (!prefetchProgramsForChannels || !viewableItems || viewableItems.length === 0) return;
      
      // Clear existing timeout
      if (viewableItemsTimeoutRef.current) {
        clearTimeout(viewableItemsTimeoutRef.current);
      }
      
      // Throttle: wait 200ms before loading to batch rapid scroll events
      viewableItemsTimeoutRef.current = setTimeout(() => {
        const visibleChannelIds = viewableItems
          .map((viewableItem) => viewableItem?.item?.id)
          .filter((id: string | undefined): id is string => id != null && id.length > 0);
        
        if (visibleChannelIds.length === 0) return;
        
        // Filter out channels we've already requested
        const channelsToLoad = visibleChannelIds.filter(
          id => !requestedChannelsRef.current.has(id)
        );
        
        if (channelsToLoad.length === 0) return;
        
        // Also prefetch a small buffer (2-3 channels) before and after visible ones
        const allChannelIds = filteredChannels.map(ch => ch?.id).filter((id): id is string => id != null);
        const prefetchIds = new Set<string>();
        
        // Add visible channels
        channelsToLoad.forEach(id => prefetchIds.add(id));
        
        // Add small buffer around visible channels
        channelsToLoad.forEach((id: string) => {
          const index = allChannelIds.indexOf(id);
          if (index !== -1) {
            const bufferSize = 3; // Smaller buffer for better performance
            const start = Math.max(0, index - bufferSize);
            const end = Math.min(allChannelIds.length, index + bufferSize);
            for (let i = start; i < end; i++) {
              if (allChannelIds[i] && !requestedChannelsRef.current.has(allChannelIds[i])) {
                prefetchIds.add(allChannelIds[i]);
              }
            }
          }
        });
        
        if (prefetchIds.size > 0) {
          const idsToLoad = Array.from(prefetchIds);
          // Mark as requested before loading
          idsToLoad.forEach(id => requestedChannelsRef.current.add(id));
          console.log('[EPG Grid Light] Lazy loading', idsToLoad.length, 'channels');
          prefetchProgramsForChannels(idsToLoad);
        }
      }, 200); // 200ms throttle
    } catch (error) {
      console.warn('[EPG Grid] Error in handleViewableItemsChanged:', error);
    }
  }, [filteredChannels, prefetchProgramsForChannels]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (viewableItemsTimeoutRef.current) {
        clearTimeout(viewableItemsTimeoutRef.current);
      }
    };
  }, []);


  if (!showEPGGrid || channels.length === 0 || !navigation) return null;

  const playlistName = playlist?.name;

  return (
    <View style={styles.container}>
      {/* Only show loading overlay during initial EPG ingestion, not during lazy loading */}
      <EPGGridLoadingOverlay visible={epgLoading && !hasAnyPrograms && filteredChannels.length > 0} />
      <EPGGridErrorMessage error={epgError} visible={!epgLoading && !!epgError} />

      <EPGGridHeader
        playlistName={playlistName}
        onRefresh={handleManualEpgRefresh}
        onSettings={handleSettings}
        onClose={handleClose}
      />

      <EPGGridGroupFilter
        groups={groups}
        selectedGroup={selectedGroup}
        onGroupSelect={setSelectedGroup}
      />

      {/* EPG Grid */}
      <View style={styles.gridContainer}>
        <EPGGridTimeHeader
          timeSlots={timeSlots}
          currentTimePosition={currentTimePosition}
          horizontalScrollX={horizontalScrollX}
          hoursToShow={HOURS_TO_SHOW}
          hourWidth={HOUR_WIDTH}
          onScroll={setHorizontalScrollX}
          scrollRef={horizontalScrollRef}
        />

        {/* Channel List with Programs - Fixed height to show 5 channels */}
        <View style={[styles.horizontalScroll, { height: ROW_HEIGHT * VISIBLE_ROWS }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontalScrollInner}
            contentContainerStyle={{ width: HOURS_TO_SHOW * HOUR_WIDTH }}
            onScroll={(e) => {
              const offsetX = e.nativeEvent.contentOffset.x;
              horizontalScrollRef.current?.scrollTo({ x: offsetX, animated: false });
            }}
            scrollEventThrottle={16}
            nestedScrollEnabled={Platform.OS === 'android'}
            focusable={Platform.OS === 'android'}
          >
            <FlashList
              ref={verticalScrollRef}
              data={filteredChannels}
              renderItem={renderChannelRow}
              keyExtractor={(item) => item.id}
              estimatedItemSize={ROW_HEIGHT}
              contentContainerStyle={flashListContentStyle}
              showsVerticalScrollIndicator={false}
              onViewableItemsChanged={handleViewableItemsChanged}
              viewabilityConfig={{
                itemVisiblePercentThreshold: 50,
                minimumViewTime: 100,
              }}
              nestedScrollEnabled={Platform.OS === 'android'}
              drawDistance={500}
            />
          </ScrollView>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  gridContainer: {
    flex: 1,
  },
  horizontalScroll: {
    flex: 1,
    overflow: 'hidden',
  },
  horizontalScrollInner: {
    flex: 1,
  },
  channelList: {
    flex: 1,
  },
});

export default EPGGridView;

