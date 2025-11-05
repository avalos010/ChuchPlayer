import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Channel } from '../../types';
import { useMultiScreenStore } from '../../store/useMultiScreenStore';
import FocusableItem from '../FocusableItem';
import { showError } from '../../utils/toast';

interface MultiScreenPlayerProps {
  screen: ReturnType<typeof useMultiScreenStore>['screens'][0];
  layout: 'grid' | 'split';
  onFocus: () => void;
  onRemove: () => void;
}

const MultiScreenPlayer: React.FC<MultiScreenPlayerProps> = ({
  screen,
  layout,
  onFocus,
  onRemove,
}) => {
  const videoRef = useRef<Video>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { updateScreen } = useMultiScreenStore();

  useEffect(() => {
    if (videoRef.current && screen.channel.url) {
      videoRef.current.loadAsync({ uri: screen.channel.url }).then(() => {
        if (screen.isPlaying) {
          videoRef.current?.playAsync();
        }
      }).catch((err) => {
        console.error('Error loading channel:', err);
        setError('Failed to load stream');
        showError('Failed to load stream', String(err));
      });
    }
  }, [screen.channel.url]);

  useEffect(() => {
    if (videoRef.current) {
      if (screen.isPlaying) {
        videoRef.current.playAsync();
      } else {
        videoRef.current.pauseAsync();
      }
    }
  }, [screen.isPlaying]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.setVolumeAsync(screen.isMuted ? 0 : screen.volume);
    }
  }, [screen.volume, screen.isMuted]);

  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        setError('Playback error');
        setLoading(false);
      }
      return;
    }
    setLoading(status.isBuffering);
    updateScreen(screen.id, { isPlaying: status.isPlaying });
  }, [screen.id, updateScreen]);

  const handlePress = useCallback(() => {
    onFocus();
  }, [onFocus]);

  const handleTogglePlayback = useCallback(() => {
    updateScreen(screen.id, { isPlaying: !screen.isPlaying });
  }, [screen.id, screen.isPlaying, updateScreen]);

  const isFocused = screen.isFocused;
  const isGridLayout = layout === 'grid';

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={handlePress}
      style={{
        flex: isGridLayout ? 1 : undefined,
        width: isGridLayout ? '50%' : '50%',
        aspectRatio: isGridLayout ? 16 / 9 : 16 / 9,
        borderWidth: isFocused ? 3 : 1,
        borderColor: isFocused ? '#00aaff' : '#333',
        backgroundColor: '#000',
        position: 'relative',
      }}
    >
      <Video
        ref={videoRef}
        source={{ uri: screen.channel.url }}
        style={{ width: '100%', height: '100%' }}
        resizeMode={ResizeMode.COVER}
        shouldPlay={screen.isPlaying}
        onLoad={() => setLoading(false)}
        onError={(err) => {
          setLoading(false);
          setError('Failed to load');
          showError('Video load error', String(err));
        }}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        useNativeControls={false}
        isLooping={false}
        volume={screen.isMuted ? 0 : screen.volume}
      />

      {/* Loading indicator */}
      {loading && !error && (
        <View className="absolute inset-0 justify-center items-center bg-black/50">
          <ActivityIndicator size="small" color="#00aaff" />
        </View>
      )}

      {/* Error state */}
      {error && (
        <View className="absolute inset-0 justify-center items-center bg-black/70">
          <Text className="text-white text-xs text-center px-2">{error}</Text>
        </View>
      )}

      {/* Channel info overlay */}
      {isFocused && (
        <View className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded">
          <Text className="text-white text-xs font-semibold" numberOfLines={1}>
            {screen.channel.name}
          </Text>
        </View>
      )}

      {/* Remove button */}
      {isFocused && (
        <FocusableItem
          onPress={onRemove}
          className="absolute top-2 right-2 w-6 h-6 bg-red-600 rounded-full justify-center items-center"
        >
          <Text className="text-white text-xs font-bold">×</Text>
        </FocusableItem>
      )}

      {/* Play/Pause overlay when focused */}
      {isFocused && !loading && !error && (
        <FocusableItem
          onPress={handleTogglePlayback}
          className="absolute inset-0 justify-center items-center bg-black/20"
        >
          <View className="w-12 h-12 rounded-full bg-black/60 justify-center items-center">
            <Text className="text-white text-xl">
              {screen.isPlaying ? '❚❚' : '▶'}
            </Text>
          </View>
        </FocusableItem>
      )}
    </TouchableOpacity>
  );
};

interface MultiScreenViewProps {
  channels: Channel[];
  onChannelSelect: (channel: Channel) => void;
}

const MultiScreenView: React.FC<MultiScreenViewProps> = ({
  channels,
  onChannelSelect,
}) => {
  const {
    screens,
    layout,
    isMultiScreenMode,
    addScreen,
    removeScreen,
    setFocusedScreen,
    setLayout,
    getScreenCount,
    canAddScreen,
    maxScreens,
  } = useMultiScreenStore();

  const handleAddScreen = useCallback(() => {
    // Show channel selection - for now, just add the first available channel
    // In a real implementation, you'd show a channel picker
    if (channels.length > 0) {
      const availableChannels = channels.filter(
        ch => !screens.some(s => s.channel.id === ch.id)
      );
      if (availableChannels.length > 0) {
        addScreen(availableChannels[0]);
      }
    }
  }, [channels, screens, addScreen]);

  if (!isMultiScreenMode || screens.length === 0) {
    return null;
  }

  const isGridLayout = layout === 'grid';
  const screenCount = screens.length;

  return (
    <View className="flex-1 bg-black">
      {/* Layout controls */}
      <View className="absolute top-4 right-4 z-10 flex-row gap-2">
        <FocusableItem
          onPress={() => setLayout('grid')}
          className={`px-3 py-2 rounded ${layout === 'grid' ? 'bg-accent' : 'bg-card'}`}
        >
          <Text className={`text-sm font-semibold ${layout === 'grid' ? 'text-white' : 'text-gray-300'}`}>
            Grid
          </Text>
        </FocusableItem>
        <FocusableItem
          onPress={() => setLayout('split')}
          className={`px-3 py-2 rounded ${layout === 'split' ? 'bg-accent' : 'bg-card'}`}
        >
          <Text className={`text-sm font-semibold ${layout === 'split' ? 'text-white' : 'text-gray-300'}`}>
            Split
          </Text>
        </FocusableItem>
      </View>

      {/* Multi-screen container */}
      <View
        style={{
          flex: 1,
          flexDirection: isGridLayout ? 'row' : 'row',
          flexWrap: isGridLayout ? 'wrap' : 'nowrap',
          padding: 8,
          gap: 8,
        }}
      >
        {screens.map((screen) => (
          <MultiScreenPlayer
            key={screen.id}
            screen={screen}
            layout={layout}
            onFocus={() => setFocusedScreen(screen.id)}
            onRemove={() => removeScreen(screen.id)}
          />
        ))}

        {/* Add screen button */}
        {canAddScreen() && (
          <TouchableOpacity
            onPress={handleAddScreen}
            activeOpacity={0.7}
            style={{
              flex: isGridLayout ? 1 : undefined,
              width: isGridLayout ? '50%' : '50%',
              aspectRatio: 16 / 9,
              borderWidth: 2,
              borderColor: '#555',
              borderStyle: 'dashed',
              backgroundColor: '#111',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text className="text-white text-2xl">+</Text>
            <Text className="text-gray-400 text-xs mt-2">Add Screen</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Screen info */}
      <View className="absolute bottom-4 left-4 bg-black/70 px-3 py-2 rounded">
        <Text className="text-white text-sm">
          {screenCount} / {maxScreens} screens
        </Text>
      </View>
    </View>
  );
};

export default MultiScreenView;

