import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Dimensions,
  FlatList,
  Platform,
  Text,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Video, ResizeMode } from 'expo-av';
import FocusableItem from '../components/FocusableItem';
import { RootStackParamList } from '../types';
import EPGOverlay from '../components/player/EPGOverlay';
import EPGGridView from '../components/player/EPGGridView';
import ChannelListPanel from '../components/player/ChannelListPanel';
import GroupsPlaylistsPanel from '../components/player/GroupsPlaylistsPanel';
import ChannelNumberPad from '../components/player/ChannelNumberPad';
import VolumeIndicator from '../components/player/VolumeIndicator';
import VideoControls from '../components/player/VideoControls';
import FloatingButtons from '../components/player/FloatingButtons';
import MultiScreenView from '../components/player/MultiScreenView';
import MultiScreenControls from '../components/player/MultiScreenControls';
import ChannelInfoCard from '../components/player/ChannelInfoCard';
import { usePlayerStore } from '../store/usePlayerStore';
import { useUIStore } from '../store/useUIStore';
import { useEPGStore } from '../store/useEPGStore';
import { useMultiScreenStore } from '../store/useMultiScreenStore';
import { useVideoPlayback } from '../hooks/useVideoPlayback';
import { useChannelNavigation } from '../hooks/useChannelNavigation';
import { useEPGManagement } from '../hooks/useEPGManagement';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { useChannelInitialization } from '../hooks/useChannelInitialization';
import { useChannelInfo } from '../hooks/useChannelInfo';
import { usePIPMode } from '../hooks/usePIPMode';
import { useEPGAutoHide } from '../hooks/useEPGAutoHide';
import { usePlayerHandlers } from '../hooks/usePlayerHandlers';


interface PlayerScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Player'>;
  route: RouteProp<RootStackParamList, 'Player'>;
}

const PlayerScreen: React.FC<PlayerScreenProps> = ({ navigation, route }) => {
  const { channel: initialChannel } = route.params || {};

  // Refs
  const videoRef = useRef<Video>(null);
  const channelListSlideAnim = useRef(new Animated.Value(-400)).current;
  const channelListRef = useRef<FlatList>(null);
  const mainViewRef = useRef<View>(null);
  const centerZoneRef = useRef<any>(null);

  // Player store state
  const channel = usePlayerStore((state) => state.channel);
  const channels = usePlayerStore((state) => state.channels);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const loading = usePlayerStore((state) => state.loading);
  const error = usePlayerStore((state) => state.error);
  const resizeMode = usePlayerStore((state) => state.resizeMode);
  
  // UI store state
  const showEPG = useUIStore((state) => state.showEPG);
  const showEPGGrid = useUIStore((state) => state.showEPGGrid);
  const showChannelList = useUIStore((state) => state.showChannelList);
  const showGroupsPlaylists = useUIStore((state) => state.showGroupsPlaylists);
  const setShowChannelList = useUIStore((state) => state.setShowChannelList);
  
  // EPG store state
  const currentProgram = useEPGStore((state) => state.currentProgram);

  // Multi-screen state
  const { isMultiScreenMode, screens } = useMultiScreenStore();
  const [showMultiScreenControls, setShowMultiScreenControls] = useState(false);

  // Custom hooks
  const { getProgramsForChannel, getCurrentProgram } = useEPGManagement();
  const { pipAnim, pipScale, enterPIP, exitPIP } = usePIPMode();
  const { showChannelInfoCard, setShowChannelInfoCard } = useChannelInfo();
  const {
    hasUserInteracted,
    setHasUserInteracted,
    handleTogglePlayback,
    handlePlaybackStatusUpdateWithError,
    handleVideoReadyWithPlayback,
    handleVideoError,
  } = useVideoPlayback(videoRef);
  const {
    handleChannelSelect,
    handleUpDpad,
    handleDownDpad,
  } = useChannelNavigation({
    videoRef,
    getCurrentProgram,
    setHasUserInteracted,
    hasUserInteracted,
    centerZoneRef,
    setShowChannelInfoCard,
  });
  const {
    handleScreenPress,
    handleCenterPress,
    handleLeftDpad,
    handleBack,
    showControlsOnFocus,
  } = usePlayerHandlers(setHasUserInteracted, hasUserInteracted, videoRef);

  // Initialize channel
  useChannelInitialization({
    initialChannel,
    getCurrentProgram,
  });

  // EPG auto-hide
  useEPGAutoHide();

  // Keyboard navigation
  useKeyboardNavigation({
    videoRef,
    navigation,
    handleChannelSelect,
    handleUpDpad: () => handleUpDpad(exitPIP),
    handleDownDpad: () => handleDownDpad(exitPIP),
    handleLeftDpad,
    handleCenterPress,
    handleBack,
    enterPIP,
    exitPIP,
    setHasUserInteracted,
    centerZoneRef,
  });

  // Animate channel list slide and scroll to current channel
  useEffect(() => {
    if (showChannelList) {
      Animated.timing(channelListSlideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      // Scroll to current channel after animation
      setTimeout(() => {
        if (channel) {
        const currentIndex = channels.findIndex(c => c.id === channel.id);
        if (currentIndex >= 0 && channelListRef.current) {
          channelListRef.current.scrollToIndex({
            index: currentIndex,
            animated: true,
            viewPosition: 0.5,
          });
          }
        }
      }, 350);
    } else {
      Animated.timing(channelListSlideAnim, {
        toValue: -420, // Slide out to left (match panel width)
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [showChannelList, channelListSlideAnim, channels, channel?.id]);

  const handleMultiScreenPress = useCallback(() => {
    setShowMultiScreenControls(true);
  }, []);

  const { width: windowWidth } = Dimensions.get('window');
  const pipPreviewWidth = Math.min(windowWidth * 0.34, 560);
  const pipPreviewHeight = pipPreviewWidth * (9 / 16);

  // If in multi-screen mode, show multi-screen view
  if (isMultiScreenMode && screens.length > 0) {
    const { width, height } = Dimensions.get('window');
    return (
      <View 
        className="flex-1 bg-black w-full h-full absolute inset-0"
        style={Platform.OS === 'web' ? {
          width,
          height,
          minHeight: height,
        } as any : undefined}
      >
        <MultiScreenView
          channels={channels}
          onChannelSelect={handleChannelSelect}
        />
        <MultiScreenControls
          channels={channels}
          onChannelSelect={handleChannelSelect}
          isVisible={showMultiScreenControls}
          onClose={() => setShowMultiScreenControls(false)}
        />
      </View>
    );
  }

  return (
    <View 
      ref={mainViewRef}
      className="flex-1 bg-black relative"
    >
      {/* Floating Buttons */}
      <FloatingButtons
        onBack={handleBack}
        onEPGInfo={() => {
          const setShowEPG = useUIStore.getState().setShowEPG;
          setShowEPG(true);
        }}
      />

      {/* Invisible D-pad navigation zones for Android TV */}
      {!showEPG && !showEPGGrid && !showChannelList && !showGroupsPlaylists && Platform.OS === 'android' && (
        <>
          {/* Central focusable zone - default focus */}
          <FocusableItem
            ref={centerZoneRef}
            onPress={() => {
              console.log('Center zone pressed');
              handleCenterPress();
            }}
            hasTVPreferredFocus={true}
            className=""
            style={{
              position: 'absolute',
              top: '25%',
              left: '25%',
              right: '25%',
              bottom: '25%',
              zIndex: 2,
              backgroundColor: 'transparent',
            }}
            focusedStyle={{
              backgroundColor: 'transparent',
              borderWidth: 0,
              borderColor: 'transparent',
              transform: [],
              elevation: 0,
              shadowColor: 'transparent',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0,
              shadowRadius: 0,
            }}
          >
            <View style={{ flex: 1, backgroundColor: 'transparent' }} />
          </FocusableItem>

          {/* Left edge - opens channel list */}
          <FocusableItem
            onPress={() => {
              console.log('Left zone pressed - opening channel list');
              handleLeftDpad();
            }}
            onFocus={() => {
              console.log('Left zone focused - opening channel list');
              handleLeftDpad();
            }}
            className=""
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 100,
              bottom: 0,
              zIndex: 2,
              backgroundColor: 'transparent',
            }}
            focusedStyle={{
              backgroundColor: 'transparent',
              borderWidth: 0,
              borderColor: 'transparent',
              transform: [],
              elevation: 0,
              shadowColor: 'transparent',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0,
              shadowRadius: 0,
            }}
          >
            <View style={{ flex: 1, backgroundColor: 'transparent' }} />
          </FocusableItem>

          {/* Top edge - previous channel */}
          <FocusableItem
            onPress={() => {
              console.log('Top zone pressed - previous channel');
              handleUpDpad(exitPIP);
              // Immediately return focus to center zone
              setTimeout(() => {
                centerZoneRef.current?.focus?.();
              }, 50);
            }}
            onFocus={() => {
              console.log('Top zone focused - switching to previous channel');
              handleUpDpad(exitPIP);
              // Immediately return focus to center zone to prevent border from showing
              setTimeout(() => {
                centerZoneRef.current?.focus?.();
              }, 10);
            }}
            className=""
            style={{
              position: 'absolute',
              top: 0,
              left: 100,
              right: 100,
              height: 100,
              zIndex: 2,
              backgroundColor: 'transparent',
            }}
            focusedStyle={{
              backgroundColor: 'transparent',
              borderWidth: 0,
              borderColor: 'transparent',
              transform: [],
              elevation: 0,
              shadowColor: 'transparent',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0,
              shadowRadius: 0,
            }}
          >
            <View style={{ flex: 1, backgroundColor: 'transparent' }} />
          </FocusableItem>

          {/* Bottom edge - next channel */}
          <FocusableItem
            onPress={() => {
              console.log('Bottom zone pressed - next channel');
              handleDownDpad(exitPIP);
              // Immediately return focus to center zone
              setTimeout(() => {
                centerZoneRef.current?.focus?.();
              }, 50);
            }}
            onFocus={() => {
              console.log('Bottom zone focused - switching to next channel');
              handleDownDpad(exitPIP);
              // Immediately return focus to center zone to prevent border from showing
              setTimeout(() => {
                centerZoneRef.current?.focus?.();
              }, 10);
            }}
            className=""
            style={{
              position: 'absolute',
              bottom: 0,
              left: 100,
              right: 100,
              height: 100,
              zIndex: 2,
              backgroundColor: 'transparent',
            }}
            focusedStyle={{
              backgroundColor: 'transparent',
              borderWidth: 0,
              borderColor: 'transparent',
              transform: [],
              elevation: 0,
              shadowColor: 'transparent',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0,
              shadowRadius: 0,
            }}
          >
            <View style={{ flex: 1, backgroundColor: 'transparent' }} />
          </FocusableItem>
        </>
      )}
      
      {/* Focusable overlay for non-Android platforms */}
      {!showEPG && !showEPGGrid && !showChannelList && !showGroupsPlaylists && Platform.OS !== 'android' && (
        <>
          {/* Main overlay for center button press and keyboard navigation */}
          <FocusableItem
            onPress={() => {
              // Mark user interaction for autoplay on web
              if (Platform.OS === 'web' && !hasUserInteracted) {
                setHasUserInteracted(true);
                // Try to play if autoplay is enabled
                if (isPlaying && videoRef.current) {
                  videoRef.current.playAsync().catch(err => {
                    console.log('Play failed:', err);
                  });
                }
              }
              handleCenterPress();
            }}
            onFocus={() => {
              showControlsOnFocus();
            }}
            className="absolute inset-0 bg-transparent"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 2,
              backgroundColor: 'transparent',
            }}
          >
            <View className="absolute inset-0 bg-transparent" />
          </FocusableItem>
        </>
      )}


      {/* Video Container - Minimized to top-right when EPG grid is shown */}
      {channel && (
        <Animated.View
          style={{
            flex: showEPGGrid ? undefined : 1,
            position: showEPGGrid ? 'absolute' : 'relative',
            top: showEPGGrid ? 32 : undefined,
            right: showEPGGrid ? 32 : undefined,
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
            transform: showEPGGrid ? [] : [
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
            <Video
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
              onLoad={handleVideoReadyWithPlayback}
              onError={handleVideoError}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdateWithError}
              useNativeControls={false}
              isLooping={false}
              volume={1.0}
              isMuted={false}
            />
          </View>
          {/* Channel name overlay when minimized */}
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
      )}

      {loading && !error && (
        <View className="absolute inset-0 justify-center items-center bg-black/70 p-6 gap-4 z-[3]">
          <ActivityIndicator size="large" color="#00aaff" />
          <Text className="text-white text-lg text-center">Loading stream...</Text>
        </View>
      )}

      {error && (
        <View
          pointerEvents="none"
          className="absolute inset-0 justify-center items-center bg-black/70 p-6 gap-4 z-[3]"
        >
          <Text className="text-white text-lg text-center font-semibold">
            {error}
          </Text>
          <Text className="text-white/80 text-base text-center">
            Press up or down on your remote to switch to another channel.
          </Text>
        </View>
      )}

      {/* Video Controls */}
      <VideoControls
        onTogglePlayback={handleTogglePlayback}
        onBack={handleBack}
        onMultiScreen={handleMultiScreenPress}
      />

      {/* Multi-Screen Controls Modal */}
      <MultiScreenControls
        channels={channels}
        onChannelSelect={handleChannelSelect}
        isVisible={showMultiScreenControls}
        onClose={() => setShowMultiScreenControls(false)}
      />

      {/* EPG Overlay - Only render when visible and navigation is ready */}
      {showEPG && (
        <EPGOverlay
          onTogglePlayback={handleTogglePlayback}
          onBack={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Settings');
            }
          }}
          navigation={navigation}
        />
      )}

      {/* EPG Grid View - Only render when visible and navigation is ready */}
      {showEPGGrid && navigation && (
        <EPGGridView
          getCurrentProgram={getCurrentProgram}
          getProgramsForChannel={getProgramsForChannel}
          onChannelSelect={handleChannelSelect}
          onExitPIP={exitPIP}
          navigation={navigation}
        />
      )}

      {/* Channel List Panel */}
      <ChannelListPanel
        onChannelSelect={handleChannelSelect}
      />

      {/* Groups & Playlists Panel */}
      <GroupsPlaylistsPanel />

      {/* Volume Indicator */}
      <VolumeIndicator />

      {/* Channel Info Card */}
      {!showEPGGrid && !showEPG && !showChannelList && !showGroupsPlaylists && (
        <ChannelInfoCard
          channel={channel}
          program={currentProgram}
          visible={showChannelInfoCard}
          onHide={() => setShowChannelInfoCard(false)}
        />
      )}

      {/* Channel Number Pad */}
      <ChannelNumberPad />
    </View>
  );
};

export default PlayerScreen;
