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
  hasTVPreferredFocus?: boolean;
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
  hasTVPreferredFocus = false,
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

  // Convert className to style object to avoid NativeWind's CssInterop.Pressable
  // This prevents navigation context errors
  const getStyleFromClassName = (cls?: string): ViewStyle => {
    if (!cls) return {};
    
    const styles: ViewStyle = {};
    
    // Basic parsing of common Tailwind classes
    if (cls.includes('rounded-lg')) styles.borderRadius = 8;
    if (cls.includes('rounded-full')) styles.borderRadius = 9999;
    if (cls.includes('rounded-xl')) styles.borderRadius = 12;
    if (cls.includes('rounded-2xl')) styles.borderRadius = 16;
    
    if (cls.includes('border')) {
      const borderMatch = cls.match(/border-(\d+)/);
      if (borderMatch) {
        styles.borderWidth = parseInt(borderMatch[1]) || 1;
      }
    }
    
    if (cls.includes('bg-accent')) styles.backgroundColor = '#00aaff';
    if (cls.includes('bg-card')) styles.backgroundColor = '#2a2a2a';
    if (cls.includes('bg-subtle')) styles.backgroundColor = '#1a1a1a';
    if (cls.includes('bg-black')) styles.backgroundColor = '#000000';
    if (cls.includes('bg-black/70')) styles.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    if (cls.includes('bg-accent/80')) styles.backgroundColor = 'rgba(0, 170, 255, 0.8)';
    if (cls.includes('bg-accent/10')) styles.backgroundColor = 'rgba(0, 170, 255, 0.1)';
    if (cls.includes('bg-accent/20')) styles.backgroundColor = 'rgba(0, 170, 255, 0.2)';
    if (cls.includes('bg-accent/15')) styles.backgroundColor = 'rgba(0, 170, 255, 0.15)';
    if (cls.includes('bg-accent/8')) styles.backgroundColor = 'rgba(0, 170, 255, 0.08)';
    
    if (cls.includes('border-accent')) styles.borderColor = '#00aaff';
    if (cls.includes('border-border')) styles.borderColor = '#404040';
    
    if (cls.includes('justify-center')) styles.justifyContent = 'center';
    if (cls.includes('items-center')) styles.alignItems = 'center';
    if (cls.includes('flex-row')) styles.flexDirection = 'row';
    if (cls.includes('flex-1')) styles.flex = 1;
    
    if (cls.includes('w-11')) styles.width = 44;
    if (cls.includes('h-11')) styles.height = 44;
    if (cls.includes('w-12')) styles.width = 48;
    if (cls.includes('h-12')) styles.height = 48;
    if (cls.includes('min-w-[90px]')) styles.minWidth = 90;
    if (cls.includes('min-w-[110px]')) styles.minWidth = 110;
    
    if (cls.includes('px-4')) {
      styles.paddingLeft = 16;
      styles.paddingRight = 16;
    }
    if (cls.includes('px-8')) {
      styles.paddingLeft = 32;
      styles.paddingRight = 32;
    }
    if (cls.includes('py-2')) {
      styles.paddingTop = 8;
      styles.paddingBottom = 8;
    }
    if (cls.includes('py-4')) {
      styles.paddingTop = 16;
      styles.paddingBottom = 16;
    }
    if (cls.includes('py-5')) {
      styles.paddingTop = 20;
      styles.paddingBottom = 20;
    }
    if (cls.includes('py-2.5')) {
      styles.paddingTop = 10;
      styles.paddingBottom = 10;
    }
    
    if (cls.includes('gap-2')) styles.gap = 8;
    if (cls.includes('gap-3')) styles.gap = 12;
    if (cls.includes('gap-4')) styles.gap = 16;
    if (cls.includes('gap-5')) styles.gap = 20;
    
    if (cls.includes('absolute')) styles.position = 'absolute';
    if (cls.includes('inset-0')) {
      styles.top = 0;
      styles.left = 0;
      styles.right = 0;
      styles.bottom = 0;
    }
    if (cls.includes('top-5')) styles.top = 20;
    if (cls.includes('left-5')) styles.left = 20;
    if (cls.includes('right-5')) styles.right = 20;
    
    if (cls.includes('z-[5]')) styles.zIndex = 5;
    if (cls.includes('z-[10]')) styles.zIndex = 10;
    if (cls.includes('z-[25]')) styles.zIndex = 25;
    
    if (cls.includes('border-l-4')) styles.borderLeftWidth = 4;
    
    return styles;
  };

  const classNameStyles = getStyleFromClassName(className);
  const focusedClassNameStyles = isFocused ? getStyleFromClassName('scale-105 border-[3px] border-accent shadow-lg') : {};

  // Build style object conditionally to avoid undefined transform
  const baseStyle: ViewStyle = {
    elevation: isFocused ? 10 : 0,
    shadowColor: isFocused ? '#00aaff' : 'transparent',
    shadowOffset: isFocused ? { width: 0, height: 4 } : { width: 0, height: 0 },
    shadowOpacity: isFocused ? 0.6 : 0,
    shadowRadius: isFocused ? 8 : 0,
  };

  // Only add transform if focused (transform must be an array, never undefined)
  if (isFocused) {
    baseStyle.transform = [{ scale: 1.05 }];
  }

  // Filter out null/undefined styles from the array
  const styleArray = [
    classNameStyles,
    focusedClassNameStyles,
    style,
    isFocused && focusedStyle,
    baseStyle,
  ].filter((s): s is ViewStyle => s != null);

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={styleArray}
      focusable={true}
      hasTVPreferredFocus={hasTVPreferredFocus}
    >
      <View pointerEvents="none">{children}</View>
    </Pressable>
  );
};

export default FocusableItem;

