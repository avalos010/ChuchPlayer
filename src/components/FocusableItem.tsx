import React, { useState } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';

interface FocusableItemProps {
  onPress: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  focusedStyle?: StyleProp<ViewStyle>;
  className?: string;
  disabled?: boolean;
}

const FocusableItem: React.FC<FocusableItemProps> = ({
  onPress,
  onFocus,
  onBlur,
  children,
  style,
  focusedStyle,
  className,
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

  const baseClasses = 'rounded-lg';
  const focusedClasses = isFocused 
    ? 'scale-105 border-[3px] border-accent shadow-lg' 
    : '';
  const combinedClasses = `${baseClasses} ${focusedClasses} ${className || ''}`.trim();

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={combinedClasses}
      style={[
        style,
        isFocused && focusedStyle,
        { 
          elevation: isFocused ? 10 : 0,
          shadowColor: isFocused ? '#00aaff' : 'transparent',
          shadowOffset: isFocused ? { width: 0, height: 4 } : { width: 0, height: 0 },
          shadowOpacity: isFocused ? 0.6 : 0,
          shadowRadius: isFocused ? 8 : 0,
        },
      ]}
    >
      <View pointerEvents="none">{children}</View>
    </Pressable>
  );
};

export default FocusableItem;
