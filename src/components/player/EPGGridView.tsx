import React, { useCallback, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity } from 'react-native';
import FocusableItem from '../FocusableItem';
import { Channel, EPGProgram } from '../../types';
import { usePlayerStore } from '../../store/usePlayerStore';

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
  
  return (
    <TouchableOpacity
      key={channel.id}
      onPress={() => onChannelSelect(channel)}
      className={`flex-row border-b border-card min-h-[80px] ${isCurrent ? 'bg-accent/10 border-l-4 border-l-accent' : ''}`}
    >
      <View className="w-[200px] bg-dark border-r border-card">
        <View className="flex-row items-center p-3 gap-3">
          {channel.logo && !imageError ? (
            <Image
              source={{ uri: channel.logo }}
              className="w-[50px] h-[50px] rounded-md bg-subtle"
              resizeMode="contain"
              onError={() => setImageError(true)}
            />
          ) : (
            <View className="w-[50px] h-[50px] rounded-md bg-subtle justify-center items-center">
              <Text className="text-white text-base font-bold">
                {channel.name.substring(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
          <View className="flex-1">
            <Text className="text-white text-sm font-semibold" numberOfLines={1}>
              {channel.name}
            </Text>
          </View>
        </View>
      </View>
      <View className="flex-row flex-1 relative">
        {program && (
          <View
            className={`absolute left-0 top-2 bottom-2 bg-card rounded-md p-3 justify-center min-w-[200px] border-l-3 ${isCurrent ? 'bg-[#003366] border-l-[#00ffaa]' : 'border-l-accent'}`}
          >
            <Text className="text-white text-sm font-semibold mb-1" numberOfLines={1}>
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
  const showEPGGrid = usePlayerStore((state) => state.showEPGGrid);
  const setShowEPGGrid = usePlayerStore((state) => state.setShowEPGGrid);
  const channels = usePlayerStore((state) => state.channels);
  const channel = usePlayerStore((state) => state.channel);
  const playlist = usePlayerStore((state) => state.playlist);

  const handleClose = useCallback(() => {
    setShowEPGGrid(false);
    onExitPIP?.();
  }, [setShowEPGGrid, onExitPIP]);

  const currentChannelId = channel?.id || '';
  const playlistName = playlist?.name;

  if (!showEPGGrid || channels.length === 0) return null;

  return (
    <View 
      className="absolute inset-0 bg-[#0a0a0a]" 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#0a0a0a',
        zIndex: 25,
        elevation: 25,
      }}
    >
      <View className="flex-row justify-between items-center p-5 bg-dark border-b-2 border-accent">
        <Text className="text-white text-2xl font-bold">Electronic Program Guide</Text>
        <FocusableItem 
          onPress={handleClose} 
          className="w-10 h-10 rounded-full bg-subtle justify-center items-center"
        >
          <Text className="text-white text-xl font-bold">✕</Text>
        </FocusableItem>
      </View>
      <ScrollView className="flex-1" horizontal>
        <View>
          {/* Time header */}
          <View className="flex-row bg-dark border-b border-card z-10">
            <View className="w-[200px] bg-dark border-r border-card" />
            {[...Array(24)].map((_, hourIndex) => (
              <View key={hourIndex} className="w-[120px] p-3 border-r border-card items-center">
                <Text className="text-accent text-xs font-semibold">
                  {hourIndex.toString().padStart(2, '0')}:00
                </Text>
              </View>
            ))}
          </View>
        {/* Channels with EPG */}
        {channels.slice(0, 50).map((ch) => {
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
