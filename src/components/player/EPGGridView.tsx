import React, { useCallback, useState, useMemo, memo, useRef, useEffect } from 'react';
import { View, Text, Image, ScrollView, FlatList, Platform, ListRenderItemInfo, Dimensions } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FocusableItem from '../FocusableItem';
import { Channel, EPGProgram } from '../../types';
import { RootStackParamList } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { groupChannelsByCategory } from '../../utils/m3uParser';

interface EPGGridViewProps {
  getCurrentProgram: (channelId: string) => EPGProgram | null;
  getProgramsForChannel?: (channelId: string) => EPGProgram[];
  onChannelSelect: (channel: Channel) => void;
  onExitPIP?: () => void;
  navigation?: NativeStackNavigationProp<RootStackParamList>;
}

interface ChannelRowData {
  channel: Channel;
  isCurrent: boolean;
  programs: EPGProgram[];
}

// TV-friendly row height - taller when focused to show program info
const ROW_HEIGHT_BASE = Platform.OS === 'android' ? 130 : 110;
const ROW_HEIGHT_FOCUSED = Platform.OS === 'android' ? 190 : 170;
const CHANNEL_COLUMN_WIDTH = Platform.OS === 'android' ? 300 : 240;
const TIME_SLOT_WIDTH = Platform.OS === 'android' ? 150 : 120;

// Memoized channel row component optimized for Android TV
const ChannelRow = memo<{
  data: ChannelRowData;
  onChannelSelect: (channel: Channel) => void;
  onFocus?: (channelId: string) => void;
  isFocused?: boolean;
  hasTVPreferredFocus?: boolean;
  currentTimePosition?: number;
}>(({ data, onChannelSelect, onFocus, isFocused = false, hasTVPreferredFocus = false, currentTimePosition }) => {
  const { channel, isCurrent, programs } = data;
  const [imageError, setImageError] = useState(false);
  
  // Calculate positions for all programs
  const programPositions = useMemo(() => {
    if (!programs || programs.length === 0) return [];
    
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    
    return programs.map(program => {
      const programStart = program.start;
      const programEnd = program.end;
      
      const startHour = programStart.getHours() + programStart.getMinutes() / 60;
      const endHour = programEnd.getHours() + programEnd.getMinutes() / 60;
      const duration = endHour - startHour;
      
      // Calculate hours from current time (slot 12 is current hour)
      const hoursFromNow = (programStart.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      // Position relative to slot 12 (current hour)
      const leftPosition = 12 * TIME_SLOT_WIDTH + (hoursFromNow * TIME_SLOT_WIDTH);
      const programWidth = Math.max(duration * TIME_SLOT_WIDTH, 120);
      
      return {
        program,
        leftPosition,
        programWidth,
        isCurrent: programStart <= now && programEnd > now,
      };
    }).filter(pos => {
      // Only show programs that are visible in the timeline (within 48 hours window)
      return pos.leftPosition >= -TIME_SLOT_WIDTH && pos.leftPosition <= 48 * TIME_SLOT_WIDTH;
    });
  }, [programs]);
  
  // Get current program for display
  const currentProgram = useMemo(() => {
    const now = new Date();
    return programs.find(p => p.start <= now && p.end > now) || null;
  }, [programs]);
  
  const handlePress = useCallback(() => {
    onChannelSelect(channel);
  }, [channel, onChannelSelect]);

  const handleFocus = useCallback(() => {
    onFocus?.(channel.id);
  }, [channel.id, onFocus]);
  
  const channelInitials = useMemo(() => 
    channel.name.substring(0, 2).toUpperCase(),
    [channel.name]
  );
  
  // Enhanced focus styles for TV
  const rowHeight = isFocused ? ROW_HEIGHT_FOCUSED : ROW_HEIGHT_BASE;
  const logoSize = Platform.OS === 'android' ? 70 : 55;
  const channelNameSize = Platform.OS === 'android' ? 'text-base' : 'text-sm';
  const programTitleSize = Platform.OS === 'android' ? 'text-lg' : 'text-base';
  
  // Alternate row background for better visibility
  const rowIndex = useMemo(() => {
    // We'll need to pass this from parent, but for now use a simple hash
    return channel.id.charCodeAt(0) % 2;
  }, [channel.id]);
  
  // For dynamic row background with modern colors
  const rowBgClass = isFocused 
    ? 'bg-slate-600' 
    : isCurrent 
      ? 'bg-slate-700' 
      : rowIndex === 0 
        ? 'bg-slate-800' 
        : 'bg-slate-900';

  const borderLeftClass = isFocused 
    ? 'border-l-4 border-l-teal-400' 
    : isCurrent 
      ? 'border-l-2 border-l-teal-500' 
      : 'border-l-0 border-l-transparent';

  return (
    <FocusableItem
      onPress={handlePress}
      onFocus={handleFocus}
      className={`flex-row border-b border-slate-700 ${rowBgClass} ${borderLeftClass}`}
      style={{ minHeight: rowHeight }}
      hasTVPreferredFocus={hasTVPreferredFocus}
      focusedStyle={{
        backgroundColor: '#475569',
        borderLeftWidth: 4,
        borderLeftColor: '#4fd1c7',
        // Override any default transform from FocusableItem
        transform: [],
      }}
    >
      {/* Channel Info Column - Fixed Width, TV-optimized */}
      <View 
        className={`border-r-2 border-slate-600 ${
          isFocused ? 'bg-slate-600' : isCurrent ? 'bg-slate-700' : 'bg-slate-800'
        }`}
        style={{ width: CHANNEL_COLUMN_WIDTH }}
      >
        <View className="flex-row items-center p-4 gap-3">
          {channel.logo && !imageError ? (
            <Image
              source={{ uri: channel.logo }}
              className="bg-slate-800 border border-slate-500 rounded-lg"
              style={{ width: logoSize, height: logoSize }}
              resizeMode="contain"
              onError={() => setImageError(true)}
            />
          ) : (
            <View 
              className="bg-slate-800 border border-slate-500 justify-center items-center rounded-lg"
              style={{ width: logoSize, height: logoSize }}
            >
              <Text className="text-gray-100 text-lg font-bold">
                {channelInitials}
              </Text>
            </View>
          )}
          <View className="flex-1">
            <Text 
              className={`font-bold mb-1 ${channelNameSize} ${
                isFocused || isCurrent ? 'text-teal-400' : 'text-gray-200'
              }`}
              numberOfLines={isFocused ? 3 : 2}
            >
              {channel.name}
            </Text>
            {channel.group && (
              <Text 
                className="text-gray-400 text-xs"
                numberOfLines={1}
              >
                {channel.group}
              </Text>
            )}
          </View>
        </View>
      </View>
      
      {/* Program Timeline Column */}
      <View className="flex-1 relative" style={{ minWidth: 48 * TIME_SLOT_WIDTH }}>
        {/* Current Time Indicator Line */}
        {currentTimePosition !== undefined && (
          <View
            className="absolute top-0 bottom-0 w-0.5 bg-teal-400 z-[20]"
            style={{ left: currentTimePosition }}
          >
            <View className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-teal-400" />
          </View>
        )}
        
        {/* Render all program blocks */}
        {programPositions.length > 0 ? (
          programPositions.map((pos, idx) => {
            const isCurrentProgram = pos.isCurrent;
            const program = pos.program;
            const timeString = `${program.start.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })} - ${program.end.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}`;
            
            return (
              <View
                key={program.id}
                className={`absolute rounded-md border ${
                  isCurrentProgram || isFocused 
                    ? 'bg-slate-600 border-teal-400' 
                    : 'bg-slate-700 border-slate-500'
                } ${isFocused && isCurrentProgram ? 'px-4 py-3.5' : 'px-3 py-2.5'}`}
                style={{
                  top: 8,
                  bottom: 8,
                  left: Math.max(0, pos.leftPosition),
                  width: pos.programWidth,
                  minWidth: 140,
                  zIndex: isCurrentProgram ? 10 : 5,
                }}
              >
                <View className="flex-1 justify-center">
                  <Text 
                    className={`font-semibold mb-1.5 ${
                      isCurrentProgram || isFocused ? 'text-white' : 'text-gray-200'
                    } ${Platform.OS === 'android' ? 'text-base' : 'text-sm'}`}
                    numberOfLines={isFocused ? 2 : 1}
                  >
                    {program.title}
                  </Text>
                  <Text 
                    className={`text-xs font-medium mt-0.5 ${
                      isCurrentProgram || isFocused ? 'text-teal-300' : 'text-gray-300'
                    }`}
                  >
                    {timeString}
                  </Text>
                  {isFocused && isCurrentProgram && program.description && (
                    <Text 
                      className="text-gray-200 text-xs mt-2 leading-4"
                      numberOfLines={2}
                    >
                      {program.description}
                    </Text>
                  )}
                </View>
              </View>
            );
          })
        ) : (
          <View 
            className="absolute left-0 w-60 rounded-md border border-slate-500 bg-slate-700/80 justify-center px-4 py-3" 
            style={{ 
              top: 8, 
              bottom: 8,
            }}
          >
            <Text 
              className="text-gray-200 text-sm font-semibold"
              numberOfLines={1}
            >
              No Data Available
            </Text>
            <Text 
              className="text-gray-400 text-xs mt-1"
            >
              EPG information not available
            </Text>
          </View>
        )}
      </View>
    </FocusableItem>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.data.channel.id === nextProps.data.channel.id &&
    prevProps.data.isCurrent === nextProps.data.isCurrent &&
    prevProps.data.programs.length === nextProps.data.programs.length &&
    prevProps.isFocused === nextProps.isFocused &&
    prevProps.hasTVPreferredFocus === nextProps.hasTVPreferredFocus &&
    prevProps.currentTimePosition === nextProps.currentTimePosition &&
    prevProps.onFocus === nextProps.onFocus
  );
});

ChannelRow.displayName = 'ChannelRow';

// Memoized time header component with TV-optimized sizing
const TimeHeader = memo<{ currentTimePosition?: number }>(({ currentTimePosition }) => {
  const timeSlots = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    return Array.from({ length: 48 }, (_, i) => {
      const hour = (currentHour - 12 + i) % 24;
      const hour24 = hour < 0 ? hour + 24 : hour;
      return {
        id: i,
        hour24,
        isCurrent: i === 12,
      };
    });
  }, []);
  
  const headerHeight = Platform.OS === 'android' ? 60 : 48;
  const timeTextSize = Platform.OS === 'android' ? 'text-base' : 'text-xs';
  
  return (
    <View className="flex-row border-b-2 border-slate-600 z-10 bg-slate-900" style={{ height: headerHeight }}>
      <View 
        className="bg-slate-900 border-r-2 border-slate-600 justify-center px-4"
        style={{ width: CHANNEL_COLUMN_WIDTH }}
      >
        <Text className="text-gray-400 text-sm font-semibold">TIME</Text>
      </View>
      <View className="flex-1 relative">
        {/* Current Time Indicator in Header */}
        {currentTimePosition !== undefined && (
          <View
            className="absolute top-0 bottom-0 w-0.5 bg-teal-400 z-[20]"
            style={{ left: currentTimePosition }}
          >
            <View className="absolute -top-2 -left-2 w-3 h-3 rounded-full bg-teal-400" />
          </View>
        )}
        <View className="flex-row">
          {timeSlots.map((slot) => (
            <View 
              key={slot.id}
              className="border-r border-slate-600 items-center justify-center bg-slate-900 py-3 px-2"
              style={{ width: TIME_SLOT_WIDTH }}
            >
              <Text className={`${timeTextSize} font-bold ${slot.isCurrent ? 'text-teal-400' : 'text-gray-400'}`}>
                {slot.hour24.toString().padStart(2, '0')}:00
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
});

TimeHeader.displayName = 'TimeHeader';

const EPGGridView: React.FC<EPGGridViewProps> = ({
  getCurrentProgram,
  getProgramsForChannel,
  onChannelSelect,
  onExitPIP,
  navigation,
}) => {
  const showEPGGrid = usePlayerStore((state) => state.showEPGGrid);
  const setShowEPGGrid = usePlayerStore((state) => state.setShowEPGGrid);
  const channels = usePlayerStore((state) => state.channels);
  const channel = usePlayerStore((state) => state.channel);
  const playlist = usePlayerStore((state) => state.playlist);

  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const flatListRef = React.useRef<FlatList>(null);
  const horizontalScrollRef = React.useRef<ScrollView>(null);
  const [focusedChannelId, setFocusedChannelId] = useState<string | null>(null);
  const [initialFocusChannelId, setInitialFocusChannelId] = useState<string | null>(null);
  const [focusedGroup, setFocusedGroup] = useState<string | null>(null);
  const [currentTimePosition, setCurrentTimePosition] = useState<number>(0);

  // Calculate current time position for indicator line (relative to time slots, not absolute)
  useEffect(() => {
    const updateTimePosition = () => {
      const now = new Date();
      const currentMinute = now.getMinutes();
      // Position is minutes from the start of the current hour slot (12th slot = index 12)
      // Current time is at slot 12 (index 12), so position within that slot
      const position = (currentMinute / 60) * TIME_SLOT_WIDTH;
      setCurrentTimePosition(12 * TIME_SLOT_WIDTH + position);
    };
    
    updateTimePosition();
    const interval = setInterval(updateTimePosition, 60000); // Update every minute
    return () => clearInterval(interval);
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

  const currentChannelId = channel?.id || '';
  const playlistName = playlist?.name;

  // Memoize groups
  const groups = useMemo(() => {
    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      return ['All'];
    }
    const grouped = groupChannelsByCategory(channels);
    const groupNames = Array.from(grouped.keys()).sort();
    return ['All', ...groupNames];
  }, [channels]);

  // Memoize filtered and prepared channel data
  const channelData = useMemo<ChannelRowData[]>(() => {
    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      return [];
    }
    
    const filtered = selectedGroup === 'All' 
      ? channels 
      : channels.filter(ch => ch && ch.group === selectedGroup);
    
    return filtered
      .filter(ch => ch != null)
      .map(ch => ({
        channel: ch,
        isCurrent: ch.id === currentChannelId,
        programs: getProgramsForChannel ? getProgramsForChannel(ch.id) : [],
      }));
  }, [channels, selectedGroup, currentChannelId, getProgramsForChannel]);

  // Scroll to current channel when opening or changing groups
  React.useEffect(() => {
    if (showEPGGrid && flatListRef.current) {
      const focusChannelId = currentChannelId || (channelData.length > 0 ? channelData[0].channel.id : null);
      if (focusChannelId) {
        setFocusedChannelId(focusChannelId);
        setInitialFocusChannelId(focusChannelId);
        const currentIndex = channelData.findIndex(d => d.channel.id === focusChannelId);
        if (currentIndex >= 0) {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({
              index: currentIndex,
              animated: false,
              viewPosition: 0.3,
            });
          }, 100);
        }
      }
    }
  }, [showEPGGrid, currentChannelId, selectedGroup, channelData]);

  // Reset focused channel when EPG grid closes
  React.useEffect(() => {
    if (!showEPGGrid) {
      setFocusedChannelId(null);
      setInitialFocusChannelId(null);
      setFocusedGroup(null);
    }
  }, [showEPGGrid]);

  // Handle focus change for navigation - expand row when focused
  const handleRowFocus = useCallback((channelId: string) => {
    setFocusedChannelId(channelId);
    const focusedIndex = channelData.findIndex(d => d.channel.id === channelId);
    if (focusedIndex >= 0 && flatListRef.current) {
      // Use scrollToIndex to ensure the expanded row is visible
      flatListRef.current.scrollToIndex({
        index: focusedIndex,
        animated: true,
        viewPosition: 0.3,
      });
    }
  }, [channelData]);

  // Render item callback
  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<ChannelRowData>) => {
    const isFocused = item.channel.id === focusedChannelId;
    const hasTVPreferredFocus = item.channel.id === initialFocusChannelId;
    
    return (
      <ChannelRow 
        data={item} 
        onChannelSelect={onChannelSelect}
        onFocus={handleRowFocus}
        isFocused={isFocused}
        hasTVPreferredFocus={hasTVPreferredFocus}
        currentTimePosition={currentTimePosition}
      />
    );
  }, [onChannelSelect, handleRowFocus, focusedChannelId, initialFocusChannelId, currentTimePosition]);

  // Key extractor
  const keyExtractor = useCallback((item: ChannelRowData) => item.channel.id, []);

  // Don't use getItemLayout with dynamic heights - let FlatList calculate automatically
  // This ensures proper scrolling when rows expand/contract

  const handleScrollToIndexFailed = useCallback((info: {
    index: number;
    highestMeasuredFrameIndex: number;
    averageItemLength: number;
  }) => {
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({
        offset: info.averageItemLength * info.index,
        animated: false,
      });
    }, 100);
  }, []);

  if (!showEPGGrid || channels.length === 0 || !navigation) return null;

  return (
    <View 
      className="absolute inset-0 bg-slate-900 z-[25]" 
      style={{ elevation: 25 }}
    >
      {/* Header - TV-optimized */}
      <View className="border-b border-slate-600 bg-gradient-to-r from-slate-800 to-slate-700">
        <View className="flex-row justify-between items-center px-6 py-6">
          <View className="flex-1">
            <Text className="text-white text-3xl font-bold tracking-tight">
              Electronic Program Guide
            </Text>
            {playlistName && (
              <Text className="text-teal-300 text-base mt-2 font-medium">{playlistName}</Text>
            )}
          </View>
          <View className="flex-row gap-4">
            <FocusableItem 
              onPress={handleSettings} 
              className="w-16 h-16 rounded-2xl bg-slate-700/80 border-2 border-slate-600 justify-center items-center shadow-lg"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 4,
              }}
              focusedStyle={{
                backgroundColor: '#475569',
                borderColor: '#4fd1c7',
                borderWidth: 3,
                transform: [{ scale: 1.15 }],
                shadowOpacity: 0.5,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <Text className="text-gray-200 text-2xl">⚙️</Text>
            </FocusableItem>
            <FocusableItem 
              onPress={handleClose} 
              className="w-16 h-16 rounded-2xl bg-red-600/80 border-2 border-red-500 justify-center items-center shadow-lg"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 4,
              }}
              focusedStyle={{
                backgroundColor: '#dc2626',
                borderColor: '#4fd1c7',
                borderWidth: 3,
                transform: [{ scale: 1.15 }],
                shadowOpacity: 0.5,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <Text className="text-white text-2xl font-bold">✕</Text>
            </FocusableItem>
          </View>
        </View>

        {/* Group Filter - Modern TV-optimized */}
        {groups && Array.isArray(groups) && groups.length > 1 && (
          <View className="px-6 pb-6 bg-slate-800/50">
            <Text className="text-gray-300 text-sm font-semibold mb-3 px-1">Categories</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 4 }}
            >
              <View className="flex-row gap-4">
                {groups.map((group, index) => {
                  const isFocused = focusedGroup === group;
                  const isSelected = selectedGroup === group;
                  return (
                    <FocusableItem
                      key={group}
                      onPress={() => setSelectedGroup(group)}
                      onFocus={() => setFocusedGroup(group)}
                      onBlur={() => setFocusedGroup(null)}
                      hasTVPreferredFocus={index === 0 && showEPGGrid}
                      className={`px-8 py-4 rounded-xl border-2 shadow-lg ${
                        isSelected
                          ? 'bg-gradient-to-br from-teal-500 to-teal-600 border-teal-400'
                          : 'bg-slate-700 border-slate-600'
                      }`}
                      style={{
                        minWidth: 120,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        elevation: 4,
                      }}
                      focusedStyle={{
                        backgroundColor: isSelected ? '#0d9488' : '#475569',
                        borderColor: '#4fd1c7',
                        borderWidth: 3,
                        transform: [{ scale: 1.08 }],
                        shadowOpacity: 0.5,
                        shadowRadius: 8,
                        elevation: 8,
                      }}
                    >
                      <View className="items-center">
                        <Text
                          className={`text-base font-bold text-center ${
                            isSelected || isFocused
                              ? 'text-white'
                              : 'text-gray-200'
                          }`}
                          numberOfLines={2}
                        >
                          {group}
                        </Text>
                        {isSelected && (
                          <View className="w-6 h-0.5 bg-white/60 rounded-full mt-2" />
                        )}
                      </View>
                    </FocusableItem>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}
                </View>

      {/* EPG Grid with Horizontal Scroll */}
      <ScrollView 
        ref={horizontalScrollRef}
        className="flex-1" 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: 12 * TIME_SLOT_WIDTH, y: 0 }}
        scrollEventThrottle={16}
      >
        <View style={{ flex: 1 }}>
          {/* Time Header */}
          <TimeHeader currentTimePosition={currentTimePosition} />
          
          {/* Virtualized Channel List */}
            <FlatList
              ref={flatListRef}
              data={channelData}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              onScrollToIndexFailed={handleScrollToIndexFailed}
            initialNumToRender={Platform.OS === 'android' ? 8 : 10}
            maxToRenderPerBatch={Platform.OS === 'android' ? 8 : 10}
            updateCellsBatchingPeriod={50}
            windowSize={Platform.OS === 'android' ? 15 : 21}
            removeClippedSubviews={Platform.OS !== 'web'}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={Platform.OS === 'android'}
          />
        </View>
      </ScrollView>
    </View>
  );
};

export default EPGGridView;
