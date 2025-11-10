import React, { useCallback, useState, useMemo, memo, useRef, useEffect } from 'react';
import { View, Text, Image, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { FlashList, ListRenderItemInfo } from '@shopify/flash-list';
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
  epgLoading?: boolean;
  epgError?: string | null;
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
  const logoSize = Platform.OS === 'android' ? 72 : 60;
  const channelNameSize = Platform.OS === 'android' ? 'text-lg' : 'text-base';

  const rowBackground = isFocused
    ? '#3b82f6'
    : isCurrent
      ? '#1f2937'
      : '#0f172a';

  const borderAccent = isFocused
    ? '#f8fafc'
    : isCurrent
      ? '#3b82f6'
      : '#1f2937';
  
  return (
    <FocusableItem
      onPress={handlePress}
      onFocus={handleFocus}
      className="border-b border-slate-900"
      style={{
        minHeight: rowHeight,
        backgroundColor: rowBackground,
        borderLeftWidth: isFocused || isCurrent ? 3 : 1,
        borderLeftColor: borderAccent,
        paddingLeft: CHANNEL_COLUMN_WIDTH,
      }}
      hasTVPreferredFocus={hasTVPreferredFocus}
      focusedStyle={Platform.OS === 'android' ? {
        backgroundColor: '#2563eb',
        borderLeftWidth: 3,
        borderLeftColor: '#f8fafc',
        transform: [],
      } : {
        backgroundColor: '#2563eb',
        borderLeftWidth: 3,
        borderLeftColor: '#f8fafc',
        transform: [{ scale: 1.01 }],
      }}
    >
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
                  className={`absolute rounded-lg border top-3 bottom-3 px-4 py-3 ${
                    isCurrentProgram
                      ? 'bg-sky-400 border-sky-200'
                      : 'bg-slate-900 border-slate-700'
                  }`}
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
                        isCurrentProgram ? 'text-slate-900' : 'text-slate-100'
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
                  className={`absolute rounded-xl border top-3 bottom-3 ${
                    isCurrentProgram || isFocused
                      ? 'bg-sky-400 border-sky-100 shadow-lg shadow-sky-900/40'
                      : 'bg-slate-900 border-slate-700'
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
                        isCurrentProgram || isFocused ? 'text-slate-900' : 'text-slate-100'
                      } ${Platform.OS === 'android' ? 'text-base' : 'text-sm'}`}
                      numberOfLines={isFocused ? 2 : 1}
                    >
                      {program.title}
                    </Text>
                    <Text 
                      className={`text-xs font-semibold ${
                        isCurrentProgram || isFocused ? 'text-slate-900' : 'text-slate-300'
                      }`}
                    >
                      {timeString}
                    </Text>
                    {isFocused && isCurrentProgram && program.description && (
                      <Text 
                        className="text-slate-900 text-xs mt-3 leading-relaxed font-medium"
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
            className="absolute top-3 bottom-3 left-0 right-0 items-center justify-center px-8"
            style={{
              borderRadius: 16,
              borderWidth: 2,
              borderColor: '#f97316',
              backgroundColor: '#111827',
              zIndex: 5,
              shadowColor: '#000',
              shadowOpacity: 0.5,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
            }}
          >
            <Text 
              className="text-white text-base font-bold uppercase tracking-[0.3em]"
              numberOfLines={1}
            >
              NO PROGRAM DATA
            </Text>
            <Text 
              className="text-orange-200 text-sm font-semibold mt-3 text-center"
            >
              Your provider did not supply guide information for this channel.
            </Text>
          </View>
        )}
      </View>

      {/* Fixed Channel Column Overlay */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: CHANNEL_COLUMN_WIDTH,
          borderRightWidth: 2,
          borderRightColor: '#1f2937',
          backgroundColor: '#020617',
          zIndex: 6,
          shadowColor: '#000',
          shadowOpacity: 0.5,
          shadowRadius: 16,
          shadowOffset: { width: 4, height: 0 },
        }}
      >
        <View className="flex-row items-center px-6 py-5 gap-4">
          {channel.logo && !imageError ? (
            <Image
              source={{ uri: channel.logo }}
              className="bg-slate-900 border border-slate-600 rounded-2xl"
              style={{ width: logoSize, height: logoSize }}
              resizeMode="contain"
              onError={() => setImageError(true)}
            />
          ) : (
            <View 
              className="bg-slate-800 border border-slate-600 justify-center items-center rounded-2xl"
              style={{ width: logoSize, height: logoSize }}
            >
              <Text className="text-white text-xl font-extrabold tracking-wide">
                {channelInitials}
              </Text>
            </View>
          )}
          <View className="flex-1">
            <Text 
              className={`font-extrabold mb-1 ${channelNameSize} leading-tight text-white`}
              numberOfLines={isFocused ? 3 : 2}
            >
              {channel.name}
            </Text>
            {channel.group && (
              <Text 
                className="text-slate-300 text-sm font-medium"
                numberOfLines={1}
              >
                {channel.group}
              </Text>
            )}
          </View>
        </View>
        {isCurrent && (
          <View className="absolute bottom-4 right-5 px-3 py-1 rounded-full bg-white">
            <Text className="text-sky-600 text-xs font-bold tracking-[0.3em]">ON NOW</Text>
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
  const timeTextSize = Platform.OS === 'android' ? 'text-base' : 'text-xs';
  
  return (
    <View
      className="border-b border-slate-800/70 z-10 bg-slate-950/95"
      style={{ height: headerHeight, paddingLeft: CHANNEL_COLUMN_WIDTH }}
    >
      {/* Timeline header */}
      <View className="flex-1 h-full relative">
        {currentTimePosition !== undefined && (
          <View
            className="absolute top-0 bottom-0 w-1 bg-cyan-400 z-[20] shadow-lg"
            style={{ left: currentTimePosition }}
          >
            <View className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-cyan-400 border-2 border-slate-950 shadow-xl" />
          </View>
        )}
        <View className="flex-row h-full">
          {timeSlots.map((slot) => (
            <View 
              key={slot.id}
              className="border-r border-slate-800/60 items-center justify-center bg-slate-950/88"
              style={{ width: TIME_SLOT_WIDTH }}
            >
              <Text className={`${timeTextSize} font-semibold tracking-wide ${slot.isCurrent ? 'text-white' : 'text-slate-300'}`}>
                {slot.hour24.toString().padStart(2, '0')}:00
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Fixed channel/time label */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: CHANNEL_COLUMN_WIDTH,
          borderRightWidth: 1,
          borderRightColor: 'rgba(71, 85, 105, 0.55)',
          backgroundColor: 'rgba(10, 19, 38, 0.96)',
          justifyContent: 'center',
          paddingHorizontal: 20,
          zIndex: 8,
          shadowColor: '#0f172a',
          shadowOpacity: 0.4,
          shadowRadius: 10,
          shadowOffset: { width: 4, height: 0 },
        }}
      >
        <Text className="text-white text-xs font-extrabold tracking-[0.35em] uppercase">TIME</Text>
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
  epgLoading = false,
  epgError = null,
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

  if (!showEPGGrid || channels.length === 0 || !navigation) return null;

  return (
    <View 
      className="absolute inset-0 bg-slate-950 z-[25]" 
      style={{ elevation: 25 }}
    >
      {epgLoading && (
        <View
          pointerEvents="none"
          className="absolute inset-0 z-[40] bg-slate-950/80 justify-center items-center px-10"
          style={{ elevation: 40 }}
        >
          <ActivityIndicator size="large" color="#22d3ee" />
          <Text className="text-cyan-100 text-base font-semibold mt-4 text-center">
            Loading program guide…
          </Text>
          <Text
            className="text-cyan-100 text-sm mt-1 text-center"
            style={{ opacity: 0.8 }}
          >
            This may take a few seconds depending on your provider.
          </Text>
        </View>
      )}

      {!epgLoading && epgError && (
        <View
          pointerEvents="none"
          className="absolute left-6 right-6 bottom-10 z-[35]"
          style={{ elevation: 35 }}
        >
          <View
            className="rounded-2xl border px-5 py-4"
            style={{
              borderColor: 'rgba(248, 113, 113, 0.45)',
              backgroundColor: 'rgba(248, 113, 113, 0.12)',
            }}
          >
            <Text className="text-red-200 text-base font-semibold mb-1">
              Unable to refresh the program guide
            </Text>
            <Text
              className="text-red-200 text-sm"
              style={{ opacity: 0.85 }}
              numberOfLines={3}
            >
              {epgError}
            </Text>
          </View>
        </View>
      )}

      {/* Header - Modern Design */}
      <View className="border-b border-slate-800/70 bg-slate-950/95">
        <View className="flex-row justify-between items-center px-8 py-6">
          <View className="flex-1">
            <Text className="text-white text-3xl font-extrabold tracking-tight mb-1">
              Electronic Program Guide
            </Text>
            {playlistName && (
              <Text className="text-slate-200 text-base font-semibold">{playlistName}</Text>
            )}
            <Text className="text-slate-300 text-xs mt-2">
              Browse live channels and upcoming shows. Use left/right to explore the timeline.
            </Text>
          </View>
          <View className="flex-row gap-4">
            <FocusableItem 
              onPress={handleSettings} 
              className="w-14 h-14 rounded-xl bg-slate-800/80 border border-slate-700 justify-center items-center"
              style={{
                elevation: 4,
              }}
              focusedStyle={Platform.OS === 'android' ? {
                backgroundColor: '#334155',
                borderColor: '#38bdf8',
                borderWidth: 2,
                transform: [],
              } : {
                backgroundColor: '#334155',
                borderColor: '#38bdf8',
                borderWidth: 2,
                transform: [{ scale: 1.06 }],
              }}
            >
              <Text className="text-gray-200 text-xl">⚙️</Text>
            </FocusableItem>
            <FocusableItem 
              onPress={handleClose} 
              className="w-14 h-14 rounded-xl bg-red-600/80 border border-red-500 justify-center items-center"
              style={{
                elevation: 4,
              }}
              focusedStyle={Platform.OS === 'android' ? {
                backgroundColor: '#dc2626',
                borderColor: '#38bdf8',
                borderWidth: 2,
                transform: [],
              } : {
                backgroundColor: '#dc2626',
                borderColor: '#38bdf8',
                borderWidth: 2,
                transform: [{ scale: 1.06 }],
              }}
            >
              <Text className="text-white text-xl font-bold">✕</Text>
            </FocusableItem>
          </View>
        </View>

        {/* Group Filter - Modern Design */}
        {groups && Array.isArray(groups) && groups.length > 1 && (
          <View className="px-8 pb-6 bg-slate-950/90 border-t border-slate-900/60">
            <Text className="text-slate-200 text-xs font-semibold mb-3 px-1 tracking-[0.3em] uppercase">Categories</Text>
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
                      className={`px-8 py-4 rounded-xl border ${
                        isSelected
                          ? 'bg-cyan-500/15 border-cyan-400/60'
                          : 'bg-slate-900/70 border-slate-800/70'
                      }`}
                      style={{
                        minWidth: 132,
                        elevation: 3,
                      }}
                      focusedStyle={Platform.OS === 'android' ? {
                        backgroundColor: isSelected ? 'rgba(8, 145, 178, 0.4)' : 'rgba(51, 65, 85, 0.9)',
                        borderColor: '#38bdf8',
                        borderWidth: 2,
                        transform: [],
                      } : {
                        backgroundColor: isSelected ? 'rgba(8, 145, 178, 0.4)' : 'rgba(51, 65, 85, 0.9)',
                        borderColor: '#38bdf8',
                        borderWidth: 2,
                        transform: [{ scale: 1.04 }],
                      }}
                    >
                      <View className="items-center">
                        <Text
                          className={`text-sm font-semibold text-center ${
                            isSelected || isFocused
                              ? 'text-white'
                              : 'text-slate-300'
                          }`}
                          numberOfLines={2}
                    >
                      {group}
                    </Text>
                        {isSelected && (
                          <View className="w-8 h-1 bg-cyan-300 rounded-full mt-2" />
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
