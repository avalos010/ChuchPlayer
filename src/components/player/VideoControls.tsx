import React from 'react';
import { View, Text } from 'react-native';
import FocusableItem from '../FocusableItem';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';

interface VideoControlsProps {
  onTogglePlayback: () => void;
  onBack: () => void;
  onMultiScreen?: () => void;
}

const VideoControls: React.FC<VideoControlsProps> = ({
  onTogglePlayback,
  onBack,
  onMultiScreen,
}) => {
  const showControls = useUIStore((state) => state.showControls);
  const showEPG = useUIStore((state) => state.showEPG);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const loading = usePlayerStore((state) => state.loading);
  const channel = usePlayerStore((state) => state.channel);
  const error = usePlayerStore((state) => state.error);

  // VideoControls is replaced by EPGOverlay - never show this component
  return null;

  const channelName = channel?.name;
  const channelGroup = channel?.group;

  return (
    <View 
      className="absolute inset-0 justify-between bg-black/30 pb-6" 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1,
      }}
    >
      <View className="flex-row items-center p-5 bg-black/60 gap-4">
        <FocusableItem 
          onPress={onBack} 
          className="bg-white/20 px-4 py-2.5 rounded-lg"
        >
          <Text className="text-white text-base font-semibold">← Back</Text>
        </FocusableItem>
        <View className="flex-1">
          {channelName && (
            <Text className="text-white text-2xl font-bold">{channelName}</Text>
          )}
          {channelGroup && (
            <Text className="text-gray-300 text-sm mt-1">{channelGroup}</Text>
          )}
        </View>
        {onMultiScreen && (
          <FocusableItem 
            onPress={onMultiScreen} 
            className="bg-accent/80 px-4 py-2.5 rounded-lg"
          >
            <Text className="text-white text-base font-semibold">📺 Multi</Text>
          </FocusableItem>
        )}
      </View>

      <View className="flex-1 justify-center items-center">
        <FocusableItem 
          onPress={onTogglePlayback} 
          className="w-[90px] h-[90px] rounded-full bg-accent/90 justify-center items-center"
        >
          <Text className="text-white text-[32px] font-bold">{isPlaying ? '❚❚' : '▶'}</Text>
        </FocusableItem>
      </View>

      <View className="px-5 py-4 bg-black/60">
        <Text className="text-white text-sm">
          {loading ? 'Buffering...' : 'Live Stream'}
        </Text>
      </View>
    </View>
  );
};

export default VideoControls;
