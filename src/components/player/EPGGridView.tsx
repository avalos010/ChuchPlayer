import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, FlatList, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FocusableItem from '../FocusableItem';
import { Channel, EPGProgram } from '../../types';
import { RootStackParamList } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { groupChannelsByCategory } from '../../utils/m3uParser';

interface EPGGridViewProps {
  getCurrentProgram: (channelId: string) => EPGProgram | null;
  onChannelSelect: (channel: Channel) => void;
  onExitPIP?: () => void;
}

// Helper component to handle individual channel row with its own image error state
const ChannelRow: React.FC<{
  channel: Channel;
  isCurrent: boolean;
  program: EPGProgram | null;
  onChannelSelect: (channel: Channel) => void;
}> = ({ channel, isCurrent, program, onChannelSelect }) => {
  const [imageError, setImageError] = useState(false);
  
  // Calculate program width and position based on time
  const now = new Date();
  const programStart = program?.start || now;
  const programEnd = program?.end || new Date(now.getTime() + 60 * 60 * 1000);
  
  // Calculate hours from start of day
  const startHour = programStart.getHours() + programStart.getMinutes() / 60;
  const endHour = programEnd.getHours() + programEnd.getMinutes() / 60;
  const duration = endHour - startHour;
  const currentHour = now.getHours() + now.getMinutes() / 60;
  
  // Each hour = 120px, calculate position and width
  // Position relative to current time (so current time shows on the left)
  const hoursFromNow = startHour - currentHour;
  const leftPosition = 220 + (hoursFromNow * 120); // 220px is the channel column width
  const programWidth = Math.max(duration * 120, 150); // Minimum 150px width
  
  return (
    <TouchableOpacity
      key={channel.id}
      onPress={() => onChannelSelect(channel)}
      className={`flex-row border-b border-border min-h-[90px] ${isCurrent ? 'bg-accent/8 border-l-4 border-l-accent' : 'border-l-4 border-l-transparent'}`}
    >
      {/* Channel Info Column */}
      <View className="w-[220px] bg-card border-r border-border">
        <View className="flex-row items-center p-4 gap-3">
          {channel.logo && !imageError ? (
            <Image
              source={{ uri: channel.logo }}
              className="w-[60px] h-[60px] rounded-lg bg-subtle border border-border"
              resizeMode="contain"
              onError={() => setImageError(true)}
            />
          ) : (
            <View className="w-[60px] h-[60px] rounded-lg bg-subtle border border-border justify-center items-center">
              <Text className="text-text-primary text-base font-bold">
                {channel.name.substring(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
          <View className="flex-1">
            <Text className="text-text-primary text-sm font-semibold mb-1" numberOfLines={1}>
              {channel.name}
            </Text>
            {channel.group && (
              <Text className="text-text-muted text-xs" numberOfLines={1}>
                {channel.group}
              </Text>
            )}
          </View>
        </View>
      </View>
      
      {/* Program Timeline Column */}
      {/* 48 hours * 120px */}
      <View className="flex-1 relative" style={{ minWidth: 5760 }}>
        {program && (
          <View
            className={`absolute top-2 bottom-2 rounded-lg p-3 justify-center border ${isCurrent ? 'bg-accent/20 border-accent' : 'bg-accent/15 border-border'}`}
            style={{
              left: Math.max(0, leftPosition), // Ensure it doesn't go negative
              width: programWidth,
              minWidth: 150,
            }}
          >
            <Text className="text-text-primary text-sm font-semibold mb-1" numberOfLines={1}>
              {program.title}
            </Text>
            <Text className="text-text-muted text-xs">
              {program.start.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              -{' '}
              {program.end.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const EPGGridView: React.FC<EPGGridViewProps> = ({
  getCurrentProgram,
  onChannelSelect,
  onExitPIP,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const showEPGGrid = usePlayerStore((state) => state.showEPGGrid);
  const setShowEPGGrid = usePlayerStore((state) => state.setShowEPGGrid);
  const channels = usePlayerStore((state) => state.channels);
  const channel = usePlayerStore((state) => state.channel);
  const playlist = usePlayerStore((state) => state.playlist);

  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const scrollViewRef = React.useRef<ScrollView>(null);

  const handleClose = useCallback(() => {
    setShowEPGGrid(false);
    onExitPIP?.();
  }, [setShowEPGGrid, onExitPIP]);

  const handleSettings = useCallback(() => {
    setShowEPGGrid(false);
    onExitPIP?.();
    navigation.navigate('Settings');
  }, [setShowEPGGrid, onExitPIP, navigation]);

  const currentChannelId = channel?.id || '';
  const playlistName = playlist?.name;

  // Get all groups from channels
  const groups = useMemo(() => {
    const grouped = groupChannelsByCategory(channels);
    const groupNames = Array.from(grouped.keys()).sort();
    return ['All', ...groupNames];
  }, [channels]);

  // Filter channels by selected group
  const filteredChannels = useMemo(() => {
    if (selectedGroup === 'All') {
      return channels;
    }
    return channels.filter(ch => ch.group === selectedGroup);
  }, [channels, selectedGroup]);

  // Don't auto-scroll - let user see the current view
  // Users can scroll manually if needed

  if (!showEPGGrid || channels.length === 0) return null;

  // Generate time slots for 24 hours
  const timeSlots = Array.from({ length: 24 }, (_, i) => i);

  return (
    <View 
      className="absolute inset-0 bg-darker z-[25]" 
      style={{
        elevation: 25,
      }}
    >
      {/* Header - TiviMate Style */}
      <View className="border-b border-border bg-card">
        <View 
          className="flex-row justify-between items-center px-6 py-4"
        >
          <View>
            <Text className="text-text-primary text-2xl font-bold tracking-tight">
              Electronic Program Guide
            </Text>
            {playlistName && (
              <Text className="text-text-muted text-sm mt-1">{playlistName}</Text>
            )}
          </View>
          <View className="flex-row gap-2">
            <FocusableItem 
              onPress={handleSettings} 
              className="w-11 h-11 rounded-full bg-subtle border border-border justify-center items-center"
            >
              <Text className="text-text-secondary text-lg font-bold">⚙️</Text>
            </FocusableItem>
            <FocusableItem 
              onPress={handleClose} 
              className="w-11 h-11 rounded-full bg-subtle border border-border justify-center items-center"
            >
              <Text className="text-text-secondary text-lg font-bold">✕</Text>
            </FocusableItem>
          </View>
        </View>

        {/* Group Filter */}
        {groups.length > 1 && (
          <View className="px-6 pb-3">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {groups.map((group) => (
                  <FocusableItem
                    key={group}
                    onPress={() => setSelectedGroup(group)}
                    className={`px-4 py-2 rounded-full border ${
                      selectedGroup === group
                        ? 'bg-accent border-accent'
                        : 'bg-card border-border'
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        selectedGroup === group
                          ? 'text-text-primary'
                          : 'text-text-muted'
                      }`}
                    >
                      {group}
                    </Text>
                  </FocusableItem>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </View>

      <ScrollView 
        ref={scrollViewRef}
        className="flex-1" 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: 12 * 120, y: 0 }}
      >
        <View>
          {/* Time Header - TiviMate Style */}
          <View 
            className="flex-row border-b border-border z-10 bg-card"
          >
            <View className="w-[220px] bg-card border-r border-border" />
            {/* Show 48 hours of time slots (current time centered) */}
            {Array.from({ length: 48 }, (_, i) => {
              const now = new Date();
              const currentHour = now.getHours();
              const hour = (currentHour - 12 + i) % 24;
              const hour24 = hour < 0 ? hour + 24 : hour;
              return (
                <View 
                  key={i}
                  className="w-[120px] p-3 border-r border-border items-center bg-card"
                >
                  <Text className={`text-xs font-semibold ${i === 12 ? 'text-accent' : 'text-text-muted'}`}>
                    {hour24.toString().padStart(2, '0')}:00
                  </Text>
                </View>
              );
            })}
          </View>
          
          {/* Channels with EPG - TiviMate Style */}
          {filteredChannels.map((ch) => {
            const isCurrent = ch.id === currentChannelId;
            const program = getCurrentProgram(ch.id);
            
            return (
              <ChannelRow
                key={ch.id}
                channel={ch}
                isCurrent={isCurrent}
                program={program}
                onChannelSelect={onChannelSelect}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

export default EPGGridView;
