import React, { useState } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

interface FocusableItemProps {
  onPress: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  focusedStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

const FocusableItem: React.FC<FocusableItemProps> = ({
  onPress,
  onFocus,
  onBlur,
  children,
  style,
  focusedStyle,
  disabled = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={({ pressed }) => [
        styles.base,
        style,
        isFocused && [styles.focused, focusedStyle],
        pressed && !isFocused && styles.pressed,
      ]}
    >
      <View pointerEvents="none">{children}</View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
  },
  focused: {
    transform: [{ scale: 1.05 }],
    borderWidth: 3,
    borderColor: '#00aaff',
    shadowColor: '#00aaff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 10,
  },
  pressed: {
    opacity: 0.9,
  },
});

export default FocusableItem;
