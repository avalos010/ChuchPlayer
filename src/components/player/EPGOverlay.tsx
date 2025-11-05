import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import FocusableItem from '../FocusableItem';
import { ResizeMode } from 'expo-av';
import { usePlayerStore } from '../../store/usePlayerStore';

interface EPGOverlayProps {
  onTogglePlayback: () => void;
  onBack: () => void;
}

const EPGOverlay: React.FC<EPGOverlayProps> = ({
  onTogglePlayback,
  onBack,
}) => {
  const showEPG = usePlayerStore((state) => state.showEPG);
  const setShowEPG = usePlayerStore((state) => state.setShowEPG);
  const channel = usePlayerStore((state) => state.channel);
  const currentProgram = usePlayerStore((state) => state.currentProgram);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const resizeMode = usePlayerStore((state) => state.resizeMode);
  const error = usePlayerStore((state) => state.error);
  const cycleResizeMode = usePlayerStore((state) => state.cycleResizeMode);
  
  const [imageError, setImageError] = useState(false);

  if (!showEPG || error || !channel) return null;

  return (
    <TouchableOpacity 
      className="absolute inset-0 bg-transparent justify-between pt-5 pb-10 px-10" 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 5,
        elevation: 5,
      }}
      activeOpacity={1} 
      onPress={() => setShowEPG(false)}
    >
      {/* Top Card - Channel Info */}
      <TouchableOpacity 
        className="bg-dark/98 rounded-xl mb-4 border-2 border-accent"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.6,
          shadowRadius: 12,
          elevation: 8,
        }}
        activeOpacity={1} 
        onPress={() => {}}
      >
        <View className="flex-row items-center p-5 gap-4">
          {channel.logo && !imageError ? (
            <Image
              source={{ uri: channel.logo }}
              className="w-[120px] h-[120px] rounded-xl bg-subtle border-2 border-accent"
              resizeMode="contain"
              onError={() => setImageError(true)}
            />
          ) : (
            <View className="w-[120px] h-[120px] rounded-xl bg-subtle border-2 border-accent justify-center items-center">
              <Text className="text-white text-[32px] font-bold">
                {channel.name.substring(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
          <View className="flex-1 gap-1.5">
            <Text className="text-white text-[28px] font-bold">{channel.name}</Text>
            {channel.group && (
              <Text className="text-text-muted text-base">{channel.group}</Text>
            )}
            {currentProgram && (
              <>
                <Text className="text-accent text-lg font-semibold mt-1">
                  {currentProgram.title}
                </Text>
                <Text className="text-gray-500 text-sm">
                  {currentProgram.start.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  -{' '}
                  {currentProgram.end.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </>
            )}
          </View>
          <FocusableItem 
            onPress={() => setShowEPG(false)} 
            className="w-10 h-10 rounded-full bg-subtle justify-center items-center"
          >
            <Text className="text-white text-xl font-bold">✕</Text>
          </FocusableItem>
        </View>
      </TouchableOpacity>

      {/* Bottom Card - Options */}
      <TouchableOpacity 
        className="bg-dark/98 rounded-xl border-2 border-accent"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.6,
          shadowRadius: 12,
          elevation: 8,
        }}
        activeOpacity={1} 
        onPress={() => {}}
      >
        <View className="flex-row justify-around p-5 gap-4">
          <FocusableItem 
            onPress={onTogglePlayback} 
            className="flex-1 items-center p-4 rounded-lg bg-accent/10 min-w-[100px]"
          >
            <Text className="text-accent text-[32px] mb-2">{isPlaying ? '❚❚' : '▶'}</Text>
            <Text className="text-white text-base font-semibold">{isPlaying ? 'Pause' : 'Play'}</Text>
          </FocusableItem>

          <FocusableItem
            onPress={cycleResizeMode}
            className="flex-1 items-center p-4 rounded-lg bg-accent/10 min-w-[100px]"
          >
            <Text className="text-accent text-[32px] mb-2">▦</Text>
            <Text className="text-white text-base font-semibold">
              {resizeMode === ResizeMode.COVER
                ? 'Cover'
                : resizeMode === ResizeMode.CONTAIN
                ? 'Fit'
                : 'Stretch'}
            </Text>
          </FocusableItem>

          <FocusableItem
            onPress={() => {
              // TODO: Implement captions/subtitles toggle
              console.log('Captions feature coming soon');
            }}
            className="flex-1 items-center p-4 rounded-lg bg-accent/10 min-w-[100px]"
          >
            <Text className="text-accent text-[32px] mb-2">CC</Text>
            <Text className="text-white text-base font-semibold">Captions</Text>
          </FocusableItem>

          <FocusableItem 
            onPress={onBack} 
            className="flex-1 items-center p-4 rounded-lg bg-accent/10 min-w-[100px]"
          >
            <Text className="text-accent text-[32px] mb-2">←</Text>
            <Text className="text-white text-base font-semibold">Back</Text>
          </FocusableItem>
        </View>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export default EPGOverlay;
