import React, { useCallback, useState, useMemo, memo, useRef, useEffect } from 'react';
import { View, Text, Image, ScrollView, Platform, ListRenderItemInfo } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FocusableItem from '../FocusableItem';
import { Channel, EPGProgram } from '../../types';
import { RootStackParamList } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
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

// Modern TV-friendly row height - taller when focused to show program info
const ROW_HEIGHT_BASE = Platform.OS === 'android' ? 140 : 120;
const ROW_HEIGHT_FOCUSED = Platform.OS === 'android' ? 200 : 180;
const CHANNEL_COLUMN_WIDTH = Platform.OS === 'android' ? 320 : 260;
const TIME_SLOT_WIDTH = Platform.OS === 'android' ? 160 : 130;

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
  
  // Enhanced focus styles for TV with modern design
  const rowHeight = isFocused ? ROW_HEIGHT_FOCUSED : ROW_HEIGHT_BASE;
  const logoSize = Platform.OS === 'android' ? 80 : 64;
  const channelNameSize = Platform.OS === 'android' ? 'text-lg' : 'text-base';
  const programTitleSize = Platform.OS === 'android' ? 'text-xl' : 'text-lg';
  
  // Alternate row background for better visibility
  const rowIndex = useMemo(() => {
    // We'll need to pass this from parent, but for now use a simple hash
    return channel.id.charCodeAt(0) % 2;
  }, [channel.id]);
  
  // Modern color scheme with better contrast
  const rowBgClass = isFocused 
    ? 'bg-slate-700/90' 
    : isCurrent 
      ? 'bg-slate-800/80' 
      : rowIndex === 0 
        ? 'bg-slate-900/60' 
        : 'bg-slate-950/50';

  const borderLeftClass = isFocused 
    ? 'border-l-4 border-l-cyan-400' 
    : isCurrent 
      ? 'border-l-3 border-l-cyan-500/70' 
      : 'border-l-0 border-l-transparent';
  
  return (
    <FocusableItem
      onPress={handlePress}
      onFocus={handleFocus}
      className={`flex-row border-b border-slate-700/50 ${rowBgClass} ${borderLeftClass}`}
      style={{ minHeight: rowHeight }}
      hasTVPreferredFocus={hasTVPreferredFocus}
      focusedStyle={Platform.OS === 'android' ? {
        backgroundColor: 'rgba(51, 65, 85, 0.95)',
        borderLeftWidth: 4,
        borderLeftColor: '#22d3ee',
        // No transforms on Android TV for better performance
        transform: [],
      } : {
        backgroundColor: 'rgba(51, 65, 85, 0.95)',
        borderLeftWidth: 4,
        borderLeftColor: '#22d3ee',
        transform: [{ scale: 1.02 }],
      }}
    >
      {/* Channel Info Column - Modern Design */}
      <View 
        className={`border-r border-slate-700/60 ${
          isFocused ? 'bg-slate-700/40' : isCurrent ? 'bg-slate-800/30' : 'bg-slate-900/20'
        }`}
        style={{ width: CHANNEL_COLUMN_WIDTH }}
      >
        <View className="flex-row items-center p-5 gap-4">
          {channel.logo && !imageError ? (
            <Image
              source={{ uri: channel.logo }}
              className="bg-slate-900/80 border-2 border-slate-600/50 rounded-xl shadow-lg"
              style={{ width: logoSize, height: logoSize }}
              resizeMode="contain"
              onError={() => setImageError(true)}
            />
          ) : (
            <View 
              className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-slate-600/50 justify-center items-center rounded-xl shadow-lg"
              style={{ width: logoSize, height: logoSize }}
            >
              <Text className="text-cyan-300 text-xl font-extrabold tracking-wide">
                {channelInitials}
              </Text>
            </View>
          )}
          <View className="flex-1">
            <Text 
              className={`font-extrabold mb-1.5 ${channelNameSize} leading-tight ${
                isFocused || isCurrent ? 'text-cyan-300' : 'text-gray-100'
              }`}
              numberOfLines={isFocused ? 3 : 2}
            >
              {channel.name}
            </Text>
            {channel.group && (
              <Text 
                className="text-gray-400 text-sm font-medium"
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
        {/* Current Time Indicator Line - Modern Design */}
        {currentTimePosition !== undefined && (
          <View
            className="absolute top-0 bottom-0 w-1 bg-cyan-400 z-[20] shadow-lg"
            style={{ left: currentTimePosition }}
          >
            <View className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-cyan-400 border-2 border-slate-900 shadow-xl" />
          </View>
        )}
        
        {/* Render program blocks with lazy loading for performance */}
        {programPositions.length > 0 ? (
          // On Android TV, only render visible programs or when focused
          Platform.OS === 'android' && !isFocused ? (
            // Simplified view for unfocused rows on Android TV - Modern Design
            programPositions.slice(0, 3).map((pos, idx) => {
              const isCurrentProgram = pos.isCurrent;
              const program = pos.program;
              
              return (
                <View
                  key={program.id}
                  className={`absolute rounded-xl border-2 top-3 bottom-3 shadow-md ${
                    isCurrentProgram 
                      ? 'bg-slate-700/90 border-cyan-400/80' 
                      : 'bg-slate-800/70 border-slate-600/50'
                  } px-4 py-3`}
                  style={{
                    left: Math.max(0, pos.leftPosition),
                    width: pos.programWidth,
                    minWidth: 160,
                    zIndex: isCurrentProgram ? 10 : 5,
                  }}
                >
                  <View className="flex-1 justify-center">
                    <Text 
                      className={`font-bold ${
                        isCurrentProgram ? 'text-cyan-50' : 'text-gray-200'
                      } ${Platform.OS === 'android' ? 'text-base' : 'text-sm'} leading-snug`}
                      numberOfLines={1}
                    >
                      {program.title}
                    </Text>
                  </View>
                </View>
              );
            })
          ) : (
            // Full detailed view for focused rows or non-Android TV - Modern Design
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
                  className={`absolute rounded-xl border-2 top-3 bottom-3 shadow-lg ${
                    isCurrentProgram || isFocused 
                      ? 'bg-slate-700/95 border-cyan-400 shadow-cyan-400/20' 
                      : 'bg-slate-800/80 border-slate-600/60'
                  } ${isFocused && isCurrentProgram ? 'px-5 py-4' : 'px-4 py-3'}`}
            style={{
                    left: Math.max(0, pos.leftPosition),
                    width: pos.programWidth,
                    minWidth: 180,
                    zIndex: isCurrentProgram ? 10 : 5,
                  }}
                >
                  <View className="flex-1 justify-center">
                    <Text 
                      className={`font-bold mb-2 leading-tight ${
                        isCurrentProgram || isFocused ? 'text-cyan-50' : 'text-gray-100'
                      } ${Platform.OS === 'android' ? 'text-lg' : 'text-base'}`}
                      numberOfLines={isFocused ? 2 : 1}
                    >
                      {program.title}
                    </Text>
                    <Text 
                      className={`text-sm font-semibold mt-1 ${
                        isCurrentProgram || isFocused ? 'text-cyan-300' : 'text-gray-400'
                      }`}
                    >
                      {timeString}
                    </Text>
                    {isFocused && isCurrentProgram && program.description && (
                      <Text 
                        className="text-gray-300 text-sm mt-3 leading-relaxed font-medium"
                        numberOfLines={2}
                      >
                        {program.description}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          )
        ) : (
          <View 
            className="absolute left-0 w-72 rounded-xl border-2 border-slate-600/60 bg-slate-800/70 justify-center px-5 py-4 top-3 bottom-3 shadow-md"
          >
            <Text 
              className="text-gray-200 text-base font-bold mb-1"
              numberOfLines={1}
            >
              No Data Available
            </Text>
            <Text 
              className="text-gray-400 text-sm font-medium"
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
  
  const headerHeight = Platform.OS === 'android' ? 70 : 56;
  const timeTextSize = Platform.OS === 'android' ? 'text-lg' : 'text-sm';
  
  return (
    <View className="flex-row border-b-2 border-slate-700/60 z-10 bg-slate-950/90 shadow-lg" style={{ height: headerHeight }}>
      <View 
        className="bg-slate-950/90 border-r-2 border-slate-700/60 justify-center px-5"
        style={{ width: CHANNEL_COLUMN_WIDTH }}
      >
        <Text className="text-cyan-300 text-base font-extrabold tracking-wider uppercase">TIME</Text>
      </View>
      <View className="flex-1 relative">
        {/* Current Time Indicator in Header - Modern Design */}
        {currentTimePosition !== undefined && (
          <View
            className="absolute top-0 bottom-0 w-1 bg-cyan-400 z-[20] shadow-lg"
            style={{ left: currentTimePosition }}
          >
            <View className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-cyan-400 border-2 border-slate-950 shadow-xl" />
          </View>
        )}
        <View className="flex-row">
      {timeSlots.map((slot) => (
        <View 
          key={slot.id}
              className="border-r border-slate-700/50 items-center justify-center bg-slate-950/80 py-4 px-3"
              style={{ width: TIME_SLOT_WIDTH }}
        >
              <Text className={`${timeTextSize} font-extrabold ${slot.isCurrent ? 'text-cyan-300' : 'text-gray-400'}`}>
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
  const showEPGGrid = useUIStore((state) => state.showEPGGrid);
  const setShowEPGGrid = useUIStore((state) => state.setShowEPGGrid);
  const channels = usePlayerStore((state) => state.channels);
  const channel = usePlayerStore((state) => state.channel);
  const playlist = usePlayerStore((state) => state.playlist);

  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const flatListRef = React.useRef<FlashList<ChannelRowData>>(null);
  const horizontalScrollRef = React.useRef<ScrollView>(null);
  const [focusedChannelId, setFocusedChannelId] = useState<string | null>(null);
  const [initialFocusChannelId, setInitialFocusChannelId] = useState<string | null>(null);
  const [focusedGroup, setFocusedGroup] = useState<string | null>(null);
  const [currentTimePosition, setCurrentTimePosition] = useState<number>(0);
  const [scrollX, setScrollX] = useState<number>(0);

  // Calculate current time position for indicator line (less frequent updates for performance)
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
    // Update every 5 minutes instead of 1 minute for better performance
    const interval = setInterval(updateTimePosition, 300000);
    return () => clearInterval(interval);
  }, []);

  // Scroll to position current time at the leftmost visible edge when EPG opens
  useEffect(() => {
    if (showEPGGrid && horizontalScrollRef.current && currentTimePosition > 0) {
      // Position current time at the leftmost edge of the visible scrollable area
      // This allows users to see current/future programs without scrolling right
      // Users can still scroll left to see past programs if they want
      const scrollXPos = Math.max(0, currentTimePosition - 20); // Small offset for visual padding
      setScrollX(scrollXPos);
      
      // Use setTimeout to ensure the ScrollView is rendered and measured
      setTimeout(() => {
        horizontalScrollRef.current?.scrollTo({
          x: scrollXPos,
          animated: false,
        });
      }, 150);
    }
  }, [showEPGGrid, currentTimePosition]);


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
      className="absolute inset-0 bg-slate-950 z-[25]" 
      style={{ elevation: 25 }}
    >
      {/* Header - Modern Design */}
      <View className="border-b-2 border-slate-700/60 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 shadow-xl">
        <View className="flex-row justify-between items-center px-8 py-7">
          <View className="flex-1">
            <Text className="text-cyan-50 text-4xl font-extrabold tracking-tight mb-2">
              Electronic Program Guide
            </Text>
            {playlistName && (
              <Text className="text-cyan-300 text-lg mt-1 font-bold">{playlistName}</Text>
            )}
          </View>
          <View className="flex-row gap-4">
            <FocusableItem 
              onPress={handleSettings} 
              className="w-16 h-16 rounded-2xl bg-slate-700/80 border-2 border-slate-600 justify-center items-center shadow-lg"
              style={{
                elevation: 4,
              }}
              focusedStyle={Platform.OS === 'android' ? {
                backgroundColor: '#475569',
                borderColor: '#4fd1c7',
                borderWidth: 3,
                // No transform on Android TV for performance
                transform: [],
              } : {
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
                elevation: 4,
              }}
              focusedStyle={Platform.OS === 'android' ? {
                backgroundColor: '#dc2626',
                borderColor: '#4fd1c7',
                borderWidth: 3,
                // No transform on Android TV for performance
                transform: [],
              } : {
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

        {/* Group Filter - Modern Design */}
        {groups && Array.isArray(groups) && groups.length > 1 && (
          <View className="px-8 pb-7 bg-slate-950/40 border-t border-slate-800/50">
            <Text className="text-cyan-200 text-base font-extrabold mb-4 px-1 tracking-wide uppercase">Categories</Text>
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
                      className={`px-10 py-5 rounded-2xl border-2 shadow-xl ${
                        isSelected
                          ? 'bg-gradient-to-br from-cyan-500 to-cyan-600 border-cyan-400 shadow-cyan-500/30'
                          : 'bg-slate-800/80 border-slate-600/60'
                      }`}
                      style={{
                        minWidth: 140,
                        elevation: 6,
                      }}
                      focusedStyle={Platform.OS === 'android' ? {
                        backgroundColor: isSelected ? '#06b6d4' : 'rgba(51, 65, 85, 0.95)',
                        borderColor: '#22d3ee',
                        borderWidth: 3,
                        // No transform on Android TV for performance
                        transform: [],
                      } : {
                        backgroundColor: isSelected ? '#06b6d4' : 'rgba(51, 65, 85, 0.95)',
                        borderColor: '#22d3ee',
                        borderWidth: 3,
                        transform: [{ scale: 1.08 }],
                        shadowOpacity: 0.5,
                        shadowRadius: 8,
                        elevation: 8,
                      }}
                    >
                      <View className="items-center">
                        <Text
                          className={`text-lg font-extrabold text-center tracking-wide ${
                            isSelected || isFocused
                              ? 'text-white'
                              : 'text-gray-200'
                          }`}
                          numberOfLines={2}
                    >
                      {group}
                    </Text>
                        {isSelected && (
                          <View className="w-8 h-1 bg-cyan-200 rounded-full mt-3 shadow-md" />
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
        scrollEventThrottle={16}
        onScroll={(event) => {
          setScrollX(event.nativeEvent.contentOffset.x);
        }}
      >
        <View className="flex-1">
          {/* Time Header */}
          <TimeHeader currentTimePosition={currentTimePosition} />
          
          {/* Virtualized Channel List - Optimized for Android TV */}
          <View style={{ flex: 1 }}>
            <FlashList
              ref={flatListRef}
              data={channelData}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              onScrollToIndexFailed={handleScrollToIndexFailed}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={Platform.OS === 'android'}
              estimatedItemSize={ROW_HEIGHT_BASE}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default EPGGridView;
