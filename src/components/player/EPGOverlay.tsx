import React, { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FocusableItem from '../FocusableItem';
import { ResizeMode } from 'expo-av';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { useEPGStore } from '../../store/useEPGStore';
import { RootStackParamList, EPGProgram } from '../../types';

interface EPGOverlayProps {
  onTogglePlayback: () => void;
  onBack: () => void;
  navigation?: NativeStackNavigationProp<RootStackParamList>;
  programs?: EPGProgram[];
  epgLoading?: boolean;
  epgError?: string | null;
}

const EPGOverlay: React.FC<EPGOverlayProps> = ({
  onTogglePlayback,
  onBack,
  navigation,
  programs = [],
  epgLoading = false,
  epgError = null,
}) => {
  
  const channel = usePlayerStore((state) => state.channel);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const resizeMode = usePlayerStore((state) => state.resizeMode);
  const error = usePlayerStore((state) => state.error);
  const cycleResizeMode = usePlayerStore((state) => state.cycleResizeMode);
  
  // UI state
  const showEPG = useUIStore((state) => state.showEPG);
  const setShowEPG = useUIStore((state) => state.setShowEPG);
  
  // EPG state
  const currentProgram = useEPGStore((state) => state.currentProgram);

  const formatTime = (date?: Date | null) => {
    if (!date) return '';
    const resolvedDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(resolvedDate.getTime())) return '';
    return resolvedDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const safeDescription = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };
  
  const [imageError, setImageError] = useState(false);

  const upcomingPrograms = useMemo(() => {
    if (!programs || programs.length === 0) return [];
    const now = new Date();
    return programs
      .filter(program => program.end > now)
      .filter(program => !currentProgram || program.id !== currentProgram.id)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 6);
  }, [programs, currentProgram]);

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
                {(() => {
                  const start = formatTime(currentProgram.start);
                  const end = formatTime(currentProgram.end);
                  if (!start || !end) return null;
                  return (
                    <Text className="text-text-muted text-sm">
                      {start} - {end}
                    </Text>
                  );
                })()}
                {safeDescription(currentProgram.description) && (
                  <Text className="text-text-muted text-xs mt-2" numberOfLines={3}>
                    {safeDescription(currentProgram.description)}
                  </Text>
                )}
              </View>
            )}

            {epgLoading && (
              <View className="mt-4 flex-row items-center gap-3">
                <ActivityIndicator size="small" color="#22d3ee" />
                <Text className="text-text-muted text-sm font-medium">
                  Loading program guide…
                </Text>
              </View>
            )}

            {!epgLoading && epgError && (
              <View
                className="mt-4 p-4 rounded-xl border"
                style={{
                  borderColor: 'rgba(248, 113, 113, 0.45)',
                  backgroundColor: 'rgba(248, 113, 113, 0.12)',
                }}
              >
                <Text className="text-red-200 text-sm font-semibold">Unable to update program guide</Text>
                <Text
                  className="text-red-200 text-xs mt-1"
                  style={{ opacity: 0.85 }}
                  numberOfLines={3}
                >
                  {epgError}
                </Text>
              </View>
            )}

            {!epgLoading && !epgError && upcomingPrograms.length > 0 && (
              <View className="mt-4 pt-4 border-t border-border">
                <Text className="text-text-primary text-base font-semibold uppercase tracking-wide mb-3">
                  Upcoming Shows
                </Text>
                <View className="gap-3">
                  {upcomingPrograms.map(program => {
                    const start = formatTime(program.start);
                    const end = formatTime(program.end);
                    const timeWindow = start && end ? `${start} - ${end}` : '';
                    const description = safeDescription(program.description);
                    return (
                      <View
                        key={program.id}
                        className="flex-row items-start justify-between border border-border rounded-xl px-4 py-3"
                        style={{ backgroundColor: 'rgba(30, 41, 59, 0.6)' }}
                      >
                        <View className="flex-1 pr-3">
                          <Text className="text-text-primary font-semibold text-base" numberOfLines={2}>
                            {program.title}
                          </Text>
                          {description && (
                            <Text className="text-text-muted text-xs mt-1" numberOfLines={2}>
                              {description}
                            </Text>
                          )}
                        </View>
                        {timeWindow ? (
                          <Text className="text-accent font-semibold text-sm pl-3 min-w-[84px]" numberOfLines={1}>
                            {timeWindow}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {!epgLoading && !epgError && upcomingPrograms.length === 0 && (
              <View className="mt-4 pt-4 border-t border-border">
                <Text className="text-text-muted text-sm">
                  Program schedule will appear once your provider shares guide data.
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
