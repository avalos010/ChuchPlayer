import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { View, ScrollView, Platform, StyleSheet, ViewStyle, Dimensions } from 'react-native';
import { FlashList, ListRenderItemInfo } from '@shopify/flash-list';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import KeyEvent from 'react-native-keyevent';
import { Channel, EPGProgram } from '../../types';
import { RootStackParamList } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { groupChannelsByCategory } from '../../utils/m3uParser';
import { instrumentFunction } from '../../hooks/usePerformanceMonitor';
import {
  EPGGridHeader,
  EPGGridCategoryDropdown,
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
  onLeftKeyPress?: (horizontalScrollX: number) => boolean; // Returns true if handled
  epgLastUpdated?: number; // Track when EPG data was last updated to force recomputation
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
  onLeftKeyPress,
  epgLastUpdated,
}) => {
  const showEPGGrid = useUIStore((state) => state.showEPGGrid);
  const setShowEPGGrid = useUIStore((state) => state.setShowEPGGrid);
  const channels = usePlayerStore((state) => state.channels);
  const channel = usePlayerStore((state) => state.channel);
  const playlist = usePlayerStore((state) => state.playlist);

  // Debug: Log when component renders
  useEffect(() => {
    if (__DEV__ && showEPGGrid) {
      console.log(`[EPG Grid] Component rendered, channels: ${channels.length}, getProgramsForChannel: ${!!getProgramsForChannel}, epgLastUpdated: ${epgLastUpdated}`);
    }
  }, [showEPGGrid, channels.length, getProgramsForChannel, epgLastUpdated]);

  // Initialize selected group to current channel's category when EPG opens
  const [selectedGroup, setSelectedGroup] = useState<string>(() => {
    if (channel?.group) {
      return channel.group;
    }
    return 'All';
  });
  
  // Update selected group when channel changes and EPG grid opens
  useEffect(() => {
    if (showEPGGrid && channel?.group) {
      setSelectedGroup(channel.group);
    }
  }, [showEPGGrid, channel?.group]);
  const [focusedChannelId, setFocusedChannelId] = useState<string | null>(null);
  const [horizontalScrollX, setHorizontalScrollX] = useState(0);
  const horizontalScrollRef = useRef<ScrollView>(null);
  const verticalScrollRef = useRef<FlashList<Channel>>(null);
  
  // UI state for categories
  const setShowGroupsPlaylists = useUIStore((state) => state.setShowGroupsPlaylists);

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

  // Get programs for a channel - memoized to prevent unnecessary recalculations
  const getChannelPrograms = useCallback((channelId: string): EPGProgram[] => {
    if (!getProgramsForChannel) return [];
    return getProgramsForChannel(channelId) || [];
  }, [getProgramsForChannel]);

  // Memoize current time to avoid creating new Date on every call
  const currentTimeRef = useRef<Date>(new Date());
  useEffect(() => {
    // Update current time every minute
    const interval = setInterval(() => {
      currentTimeRef.current = new Date();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Calculate program position and width - optimized
  // Timeline starts at current hour (00:00 of current hour), not current time
  const getProgramStyle = useCallback(
    instrumentFunction(
      (program: EPGProgram) => {
        try {
          if (!program?.start || !program?.end) {
            return { left: 0, width: 80 };
          }
          
          const now = currentTimeRef.current;
          const programStart = program.start instanceof Date ? program.start : new Date(program.start);
          const programEnd = program.end instanceof Date ? program.end : new Date(program.end);
          
          // Validate dates
          if (isNaN(programStart.getTime()) || isNaN(programEnd.getTime())) {
            return { left: 0, width: 80 };
          }
          
          // Calculate timeline start (beginning of current hour)
          const timelineStart = new Date(now);
          timelineStart.setMinutes(0, 0, 0);
          
          // Calculate hours from timeline start (can be negative for past programs)
          const hoursFromTimelineStart = (programStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60);
    const duration = (programEnd.getTime() - programStart.getTime()) / (1000 * 60 * 60);
    
          // Calculate position relative to timeline start
          const left = hoursFromTimelineStart * HOUR_WIDTH;
    const width = Math.max(duration * HOUR_WIDTH, 80);
    
    return {
            left: left,
            width: Math.min(width, HOURS_TO_SHOW * HOUR_WIDTH * 2), // Allow wider programs
          };
        } catch (error) {
          return { left: 0, width: 80 };
        }
      },
      'getProgramStyle'
    ),
    []
  );

  // Check if program is currently playing - optimized with memoized time
  const isProgramNow = useCallback(
    instrumentFunction(
      (program: EPGProgram) => {
        try {
          if (!program?.start || !program?.end) return false;
          
          const now = currentTimeRef.current;
          const programStart = program.start instanceof Date ? program.start : new Date(program.start);
          const programEnd = program.end instanceof Date ? program.end : new Date(program.end);
          
          if (isNaN(programStart.getTime()) || isNaN(programEnd.getTime())) {
            return false;
          }
          
          return programStart <= now && programEnd > now;
        } catch (error) {
          return false;
        }
      },
      'isProgramNow'
    ),
    []
  );

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

  // Pre-compute channel data to avoid repeated lookups during render
  // This map is updated when programsByChannel changes, not on every render
  // Include epgLastUpdated to force recomputation when EPG data is loaded
  const channelDataMap = useMemo(() => {
    if (__DEV__) {
      console.log(`[EPG Grid] Computing channelDataMap for ${filteredChannels.length} channels, epgLastUpdated: ${epgLastUpdated}`);
    }
    
    const start = performance.now();
    const map = new Map<string, { programs: EPGProgram[]; currentProgram: EPGProgram | null }>();
    
    // Only compute for filtered channels to limit work
    filteredChannels.forEach((ch) => {
      const programs = getChannelPrograms(ch.id);
      const currentProgram = getCurrentProgram(ch.id);
      map.set(ch.id, { programs, currentProgram });
      
      // Debug: Always log for first few channels
      if (__DEV__) {
        console.log(`[EPG Grid] Channel "${ch.name}" (${ch.id}): ${programs.length} programs, currentProgram: ${currentProgram?.title || 'none'}`);
        if (programs.length > 0) {
          console.log(`[EPG Grid] First program: "${programs[0].title}" from ${programs[0].start} to ${programs[0].end}`);
        }
      }
    });
    
    const duration = performance.now() - start;
    if (__DEV__) {
      console.log(`[PERF] channelDataMap computation took ${duration.toFixed(2)}ms for ${filteredChannels.length} channels`);
    }
    
    return map;
  }, [filteredChannels, getChannelPrograms, getCurrentProgram, epgLastUpdated]);

  // Check if we have any programs loaded - computed from pre-computed data
  const hasAnyPrograms = useMemo(() => {
    if (filteredChannels.length === 0) return false;
    // Only check first 3 channels for performance
    return filteredChannels.slice(0, 3).some(ch => {
      const channelData = channelDataMap.get(ch.id);
      return channelData?.programs && channelData.programs.length > 0;
    });
  }, [filteredChannels, channelDataMap]);

  // Render channel row - optimized to use pre-computed data
  const renderChannelRow = useCallback(
    instrumentFunction(
      ({ item: ch }: ListRenderItemInfo<Channel>) => {
    const isCurrent = ch.id === channel?.id;
    const isFocused = ch.id === focusedChannelId;
        
        // Use pre-computed data - O(1) lookup, no computation during render
        const channelData = channelDataMap.get(ch.id);
        const programs = channelData?.programs ?? [];
        const currentProgram = channelData?.currentProgram ?? null;

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
      'renderChannelRow'
    ),
    [
    channel,
    focusedChannelId,
      channelDataMap,
    getProgramStyle,
    isProgramNow,
    onChannelSelect,
    currentTimePosition,
    horizontalScrollX,
    ]
  );

  // Scroll to current time on mount - ensure we can see current programs
  useEffect(() => {
    if (showEPGGrid && horizontalScrollRef.current) {
      setTimeout(() => {
        // Scroll to show current time (which is at position 0 in our calculation)
        // But we need to account for the channel width offset
        const scrollX = Math.max(0, currentTimePosition - CHANNEL_WIDTH - 100);
        horizontalScrollRef.current?.scrollTo({
          x: scrollX,
          animated: false,
        });
        setHorizontalScrollX(scrollX);
      }, 200);
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

  // Expose scroll position to parent for left key handling
  const horizontalScrollXRef = useRef(horizontalScrollX);
  useEffect(() => {
    horizontalScrollXRef.current = horizontalScrollX;
  }, [horizontalScrollX]);

  // Handle left key press in EPG grid - open categories if at leftmost position
  useEffect(() => {
    if (!showEPGGrid || Platform.OS !== 'android') return;

    try {
      const keyDownListener = (keyEvent: any) => {
        const { keyCode } = keyEvent;
        
        // DPAD_LEFT = 21
        if (keyCode === 21) {
          const currentScrollX = horizontalScrollXRef.current;
          
          // Check if we're at the leftmost position (horizontalScrollX is 0 or very close)
          // Allow a small threshold (10px) to account for floating point precision
          if (currentScrollX <= 10) {
            // We're at the leftmost position, open categories
            setShowGroupsPlaylists(true);
            // If parent handler is provided, also call it
            if (onLeftKeyPress) {
              onLeftKeyPress(currentScrollX);
            }
          } else if (onLeftKeyPress) {
            // Let parent handle it if not at leftmost position
            onLeftKeyPress(currentScrollX);
          }
          // Otherwise, let the default scrolling behavior handle it
        }
      };

      KeyEvent.onKeyDownListener(keyDownListener);

      return () => {
        KeyEvent.removeKeyDownListener();
      };
    } catch (error) {
      // KeyEvent might not be available, ignore
    }
  }, [showEPGGrid, setShowGroupsPlaylists, onLeftKeyPress]);

  // Track which channels have been requested to avoid duplicate requests
  const requestedChannelsRef = useRef<Set<string>>(new Set());
  
  // Load EPG data when grid opens - only load a small initial batch
  useEffect(() => {
    console.log(`[EPG Grid] Prefetch effect - showEPGGrid: ${showEPGGrid}, filteredChannels: ${filteredChannels.length}, prefetchProgramsForChannels: ${!!prefetchProgramsForChannels}`);
    if (showEPGGrid && filteredChannels.length > 0 && prefetchProgramsForChannels) {
      // Only load first 5-8 visible channels initially for faster startup
      const initialChannelIds = filteredChannels
        .slice(0, 8)
        .map(ch => ch.id)
        .filter(id => !requestedChannelsRef.current.has(id));
      
      console.log(`[EPG Grid] Prefetching programs for ${initialChannelIds.length} channels:`, initialChannelIds);
      if (initialChannelIds.length > 0) {
        initialChannelIds.forEach(id => requestedChannelsRef.current.add(id));
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
  
  // Lazy load EPG data for visible channels only - optimized with longer throttle
  const handleViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: Array<{ item: Channel; index: number | null }> }) => {
    try {
      if (!prefetchProgramsForChannels || !viewableItems || viewableItems.length === 0) return;
      
      // Clear existing timeout
      if (viewableItemsTimeoutRef.current) {
        clearTimeout(viewableItemsTimeoutRef.current);
      }
      
      // Throttle: wait 300ms before loading to batch rapid scroll events (increased for performance)
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
        
        // Also prefetch a small buffer (2 channels) before and after visible ones
        const allChannelIds = filteredChannels.map(ch => ch?.id).filter((id): id is string => id != null);
      const prefetchIds = new Set<string>();
      
        // Add visible channels
        channelsToLoad.forEach(id => prefetchIds.add(id));
        
        // Add small buffer around visible channels (reduced from 3 to 2 for performance)
        channelsToLoad.forEach((id: string) => {
        const index = allChannelIds.indexOf(id);
        if (index !== -1) {
            const bufferSize = 2; // Smaller buffer for better performance
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
          prefetchProgramsForChannels(idsToLoad);
        }
      }, 300); // 300ms throttle (increased for better performance)
    } catch (error) {
      // Silently handle errors to avoid performance impact
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


  // Always log when component is called (even if returning early)
  console.log(`[EPG Grid] Component called - showEPGGrid: ${showEPGGrid}, channels: ${channels.length}, navigation: ${!!navigation}`);
  
  if (!showEPGGrid || channels.length === 0 || !navigation) {
    console.log(`[EPG Grid] Early return - not rendering`);
    return null;
  }
  
  console.log(`[EPG Grid] Rendering EPG grid with ${filteredChannels.length} filtered channels`);

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
        categoryDropdown={
          <EPGGridCategoryDropdown
            groups={groups}
            selectedGroup={selectedGroup}
            onGroupSelect={setSelectedGroup}
          />
        }
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
        <View style={[styles.channelListContainer, { height: ROW_HEIGHT * VISIBLE_ROWS }]}>
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
              drawDistance={300}
              // Force FlashList to use the container height
              style={{ height: ROW_HEIGHT * VISIBLE_ROWS }}
              // Performance optimizations
              removeClippedSubviews={true}
              estimatedListSize={{ height: ROW_HEIGHT * VISIBLE_ROWS, width: HOURS_TO_SHOW * HOUR_WIDTH }}
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
    backgroundColor: '#1e293b',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    elevation: 50,
  },
  gridContainer: {
    flex: 1,
  },
  channelListContainer: {
    overflow: 'visible', // Allow programs to be visible when scrolling
  },
  horizontalScroll: {
    flex: 1,
    overflow: 'hidden',
  },
  horizontalScrollInner: {
    height: ROW_HEIGHT * VISIBLE_ROWS,
  },
  channelList: {
    flex: 1,
  },
});

export default EPGGridView;

