import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FocusableItem from '../FocusableItem';
import { ResizeMode } from 'expo-av';
import { usePlayerStore } from '../../store/usePlayerStore';
import { RootStackParamList } from '../../types';

interface EPGOverlayProps {
  onTogglePlayback: () => void;
  onBack: () => void;
  navigation?: NativeStackNavigationProp<RootStackParamList>;
}

const EPGOverlay: React.FC<EPGOverlayProps> = ({
  onTogglePlayback,
  onBack,
  navigation,
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
      className="absolute inset-0 z-[5] bg-transparent" 
      style={{
        elevation: 5,
      }}
      activeOpacity={1} 
      onPress={() => setShowEPG(false)}
    >
      <ScrollView 
        className="flex-1 pt-8 pb-12 px-8"
        contentContainerStyle={{ justifyContent: 'space-between', flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Card - Channel Info - TiviMate Style */}
        <TouchableOpacity 
        className="rounded-2xl border border-border bg-card shadow-lg"
        style={{
          elevation: 12,
        }}
        activeOpacity={1} 
        onPress={() => {}}
      >
        <View className="flex-row items-center p-6 gap-5">
          {channel.logo && !imageError ? (
            <Image
              source={{ uri: channel.logo }}
              className="w-[140px] h-[140px] rounded-2xl bg-subtle border border-border"
              resizeMode="contain"
              onError={() => setImageError(true)}
            />
          ) : (
            <View className="w-[140px] h-[140px] rounded-2xl bg-subtle border border-border justify-center items-center">
              <Text className="text-text-primary text-[40px] font-bold tracking-wide">
                {channel.name.substring(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
          <View className="flex-1 gap-2">
            <Text className="text-text-primary text-[32px] font-bold tracking-tight" numberOfLines={1}>
              {channel.name}
            </Text>
            {channel.group && (
              <Text className="text-text-muted text-base font-medium">{channel.group}</Text>
            )}
            {currentProgram && (
              <View className="mt-3 pt-3 border-t border-border">
                <Text className="text-accent text-xl font-semibold mb-1" numberOfLines={2}>
                  {currentProgram.title}
                </Text>
                <Text className="text-text-muted text-sm">
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
              </View>
            )}
          </View>
          <FocusableItem 
            onPress={() => setShowEPG(false)} 
            className="w-12 h-12 rounded-full bg-subtle border border-border justify-center items-center"
          >
            <Text className="text-text-secondary text-xl font-bold">✕</Text>
          </FocusableItem>
        </View>
      </TouchableOpacity>

      {/* Bottom Card - Options - TiviMate Style */}
      <TouchableOpacity 
        className="rounded-2xl border border-border bg-card shadow-lg"
        style={{
          elevation: 12,
        }}
        activeOpacity={1} 
        onPress={() => {}}
      >
        <View className="flex-row justify-around p-6 gap-3">
          <FocusableItem 
            onPress={onTogglePlayback} 
            className={`flex-1 items-center py-5 px-4 rounded-xl border min-w-[110px] ${isPlaying ? 'bg-accent/15 border-accent' : 'bg-accent/10 border-border'}`}
          >
            <Text className="text-accent text-[36px] mb-2">{isPlaying ? '❚❚' : '▶'}</Text>
            <Text className="text-text-primary text-sm font-semibold">{isPlaying ? 'Pause' : 'Play'}</Text>
          </FocusableItem>

          <FocusableItem
            onPress={cycleResizeMode}
            className="flex-1 items-center py-5 px-4 rounded-xl border border-border bg-accent/10 min-w-[110px]"
          >
            <Text className="text-accent text-[36px] mb-2">▦</Text>
            <Text className="text-text-primary text-sm font-semibold">
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
            className="flex-1 items-center py-5 px-4 rounded-xl border border-border bg-accent/10 min-w-[110px]"
          >
            <Text className="text-accent text-[36px] mb-2">CC</Text>
            <Text className="text-text-primary text-sm font-semibold">Captions</Text>
          </FocusableItem>

          <FocusableItem 
            onPress={() => setShowEPG(false)} 
            className="flex-1 items-center py-5 px-4 rounded-xl border border-border bg-accent/10 min-w-[110px]"
          >
            <Text className="text-accent text-[36px] mb-2">←</Text>
            <Text className="text-text-primary text-sm font-semibold">Back</Text>
          </FocusableItem>

          <FocusableItem 
            onPress={() => {
              setShowEPG(false);
              if (navigation) {
                try {
                  navigation.navigate('Settings');
                } catch (error) {
                  console.log('Navigation not ready:', error);
                }
              }
            }} 
            className="flex-1 items-center py-5 px-4 rounded-xl border border-border bg-accent/10 min-w-[110px]"
          >
            <Text className="text-accent text-[36px] mb-2">⚙️</Text>
            <Text className="text-text-primary text-sm font-semibold">Settings</Text>
          </FocusableItem>
        </View>
      </TouchableOpacity>
      </ScrollView>
    </TouchableOpacity>
  );
};

export default EPGOverlay;
