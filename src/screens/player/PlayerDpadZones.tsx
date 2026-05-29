import React from 'react';
import { Platform, View } from 'react-native';
import FocusableItem from '../../components/FocusableItem';

interface PlayerDpadZonesProps {
  hasModalOverlay: boolean;
  centerZoneRef: React.RefObject<any>;
  onCenterPress: () => void;
  onLeftPress: () => void;
  onUpPress: () => void;
  onUpFocus: () => void;
  onDownPress: () => void;
  onDownFocus: () => void;
  hasUserInteracted: boolean;
  isPlaying: boolean;
  onFirstInteraction: () => void;
  showControlsOnFocus: () => void;
  children?: React.ReactNode;
}

const TRANSPARENT_FLEX = { flex: 1, backgroundColor: 'transparent' as const };
const DPAD_INVISIBLE_FOCUSED_STYLE = {
  backgroundColor: 'transparent' as const,
  borderWidth: 0,
  borderColor: 'transparent' as const,
  transform: [] as any[],
  elevation: 0,
  shadowColor: 'transparent' as const,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
};
const DPAD_CENTER_STYLE = {
  position: 'absolute' as const,
  top: '25%' as any,
  left: '25%' as any,
  right: '25%' as any,
  bottom: '25%' as any,
  zIndex: 2,
  backgroundColor: 'transparent' as const,
};
const DPAD_LEFT_STYLE = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  width: 100,
  bottom: 0,
  zIndex: 2,
  backgroundColor: 'transparent' as const,
};
const DPAD_TOP_STYLE = {
  position: 'absolute' as const,
  top: 0,
  left: 100,
  right: 100,
  height: 100,
  zIndex: 2,
  backgroundColor: 'transparent' as const,
};
const DPAD_BOTTOM_STYLE = {
  position: 'absolute' as const,
  bottom: 0,
  left: 100,
  right: 100,
  height: 100,
  zIndex: 2,
  backgroundColor: 'transparent' as const,
};

const PlayerDpadZones: React.FC<PlayerDpadZonesProps> = ({
  hasModalOverlay,
  centerZoneRef,
  onCenterPress,
  onLeftPress,
  onUpPress,
  onUpFocus,
  onDownPress,
  onDownFocus,
  hasUserInteracted,
  isPlaying,
  onFirstInteraction,
  showControlsOnFocus,
  children,
}) => {
  if (hasModalOverlay) return null;

  if (Platform.OS === 'android') {
    return (
      <>
        <FocusableItem
          ref={centerZoneRef}
          onPress={onCenterPress}
          hasTVPreferredFocus={true}
          className=""
          style={DPAD_CENTER_STYLE}
          focusedStyle={DPAD_INVISIBLE_FOCUSED_STYLE}
        >
          <View style={TRANSPARENT_FLEX} />
        </FocusableItem>

        <FocusableItem
          onPress={onLeftPress}
          onFocus={onLeftPress}
          className=""
          style={DPAD_LEFT_STYLE}
          focusedStyle={DPAD_INVISIBLE_FOCUSED_STYLE}
        >
          <View style={TRANSPARENT_FLEX} />
        </FocusableItem>

        <FocusableItem
          onPress={onUpPress}
          onFocus={onUpFocus}
          className=""
          style={DPAD_TOP_STYLE}
          focusedStyle={DPAD_INVISIBLE_FOCUSED_STYLE}
        >
          <View style={TRANSPARENT_FLEX} />
        </FocusableItem>

        <FocusableItem
          onPress={onDownPress}
          onFocus={onDownFocus}
          className=""
          style={DPAD_BOTTOM_STYLE}
          focusedStyle={DPAD_INVISIBLE_FOCUSED_STYLE}
        >
          <View style={TRANSPARENT_FLEX} />
        </FocusableItem>
      </>
    );
  }

  return (
    <FocusableItem
      onPress={() => {
        if (!hasUserInteracted && isPlaying) {
          onFirstInteraction();
        }
        onCenterPress();
      }}
      onFocus={showControlsOnFocus}
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
      {children ?? <View className="absolute inset-0 bg-transparent" />}
    </FocusableItem>
  );
};

export default PlayerDpadZones;
