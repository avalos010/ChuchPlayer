import React from 'react';
import { Animated, Platform, Text, View } from 'react-native';
import type { PlayerVideoHandle } from '../../types/video';
import AppVideo from '../../components/player/AppVideo';
import ExoPlayerVideoView from '../../components/player/ExoPlayerVideoView';
import { EPGProgram, Channel } from '../../types';
import { ResizeMode } from 'expo-av';

// On Android use the native ExoPlayer/PlayerView pair; expo-av everywhere else.
const VideoPlayer: typeof AppVideo =
  Platform.OS === 'android' ? (ExoPlayerVideoView as typeof AppVideo) : AppVideo;

interface PlayerVideoStageProps {
  channel: Channel;
  currentProgram: EPGProgram | null;
  showEPGGrid: boolean;
  pipAnim: { x: Animated.Value; y: Animated.Value };
  pipScale: Animated.Value;
  pipPreviewWidth: number;
  pipPreviewHeight: number;
  videoRef: React.RefObject<PlayerVideoHandle | null>;
  resizeMode: ResizeMode;
  isPlaying: boolean;
  onLoad: () => void;
  onError: (error: any) => void;
  onPlaybackStatusUpdate: (status: any) => void;
}

const PlayerVideoStage: React.FC<PlayerVideoStageProps> = ({
  channel,
  currentProgram,
  showEPGGrid,
  pipAnim,
  pipScale,
  pipPreviewWidth,
  pipPreviewHeight,
  videoRef,
  resizeMode,
  isPlaying,
  onLoad,
  onError,
  onPlaybackStatusUpdate,
}) => (
  <Animated.View
    style={{
      flex: showEPGGrid ? undefined : 1,
      position: showEPGGrid ? 'absolute' : 'relative',
      top: showEPGGrid ? 48 : undefined,
      right: showEPGGrid ? 48 : undefined,
      width: showEPGGrid ? pipPreviewWidth : undefined,
      height: showEPGGrid ? pipPreviewHeight : undefined,
      zIndex: showEPGGrid ? 40 : 1,
      elevation: showEPGGrid ? 40 : 1,
      borderRadius: showEPGGrid ? 20 : 0,
      overflow: 'hidden',
      borderWidth: showEPGGrid ? 1 : 0,
      borderColor: showEPGGrid ? 'rgba(148, 163, 184, 0.45)' : 'transparent',
      backgroundColor: showEPGGrid ? '#0f172a' : 'transparent',
      shadowColor: showEPGGrid ? '#0ea5e9' : 'transparent',
      shadowOffset: showEPGGrid ? { width: 0, height: 12 } : { width: 0, height: 0 },
      shadowOpacity: showEPGGrid ? 0.3 : 0,
      shadowRadius: showEPGGrid ? 24 : 0,
      transform: showEPGGrid
        ? []
        : [
            { translateX: pipAnim.x },
            { translateY: pipAnim.y },
            { scale: pipScale },
          ],
    }}
    focusable={false}
    importantForAccessibility="no"
  >
    <View
      style={{ flex: 1, position: 'relative', backgroundColor: '#020617' }}
      focusable={false}
      importantForAccessibility="no"
    >
      <VideoPlayer
        key={`video-${channel.id}-${channel.url}`}
        ref={videoRef}
        source={{ uri: channel.url }}
        style={{
          flex: 1,
          width: Platform.OS === 'web' ? '-webkit-fill-available' : '100%',
          height: '100%',
          margin: Platform.OS === 'web' ? 'auto' : 0,
          backgroundColor: '#020617',
        } as any}
        focusable={false}
        resizeMode={resizeMode}
        shouldPlay={isPlaying}
        onLoad={onLoad}
        onError={onError}
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        progressUpdateIntervalMillis={2500}
        useNativeControls={false}
        isLooping={false}
        volume={1.0}
        isMuted={false}
      />
    </View>

    {showEPGGrid && (
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
        pointerEvents="none"
      >
        <Text
          style={{
            color: '#fff',
            fontSize: 16,
            fontWeight: '700',
          }}
          numberOfLines={1}
        >
          {channel.name}
        </Text>
        {currentProgram && (
          <Text
            style={{
              color: '#bae6fd',
              fontSize: 12,
              fontWeight: '600',
              marginTop: 4,
            }}
            numberOfLines={1}
          >
            {currentProgram.title}
          </Text>
        )}
      </View>
    )}
  </Animated.View>
);

export default PlayerVideoStage;
