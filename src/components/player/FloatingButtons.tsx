import React from 'react';
import { Text } from 'react-native';
import FocusableItem from '../FocusableItem';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';

interface FloatingButtonsProps {
  onBack: () => void;
  onEPGInfo: () => void;
}

const FloatingButtons: React.FC<FloatingButtonsProps> = ({
  onBack,
  onEPGInfo,
}) => {
  const showFloatingButtons = useUIStore((state) => state.showFloatingButtons);
  const showEPG = useUIStore((state) => state.showEPG);
  const error = usePlayerStore((state) => state.error);

  if (!showFloatingButtons || error || showEPG) return null;

  return (
    <>
      <FocusableItem 
        onPress={onBack} 
        className="absolute top-5 left-5 w-12 h-12 rounded-full bg-black/70 justify-center items-center"
        style={{ 
          position: 'absolute',
          top: 20,
          left: 20,
          width: 48,
          height: 48,
          zIndex: 10,
          elevation: 10,
        }}
      >
        <Text className="text-white text-2xl font-bold">←</Text>
      </FocusableItem>
      <FocusableItem 
        onPress={onEPGInfo} 
        className="absolute top-5 right-5 w-12 h-12 rounded-full bg-accent/80 justify-center items-center"
        style={{ 
          position: 'absolute',
          top: 20,
          right: 20,
          width: 48,
          height: 48,
          zIndex: 10,
          elevation: 10,
        }}
      >
        <Text className="text-white text-[28px] font-bold">ℹ</Text>
      </FocusableItem>
    </>
  );
};

export default FloatingButtons;
