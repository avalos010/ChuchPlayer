import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';

const VolumeIndicator: React.FC = () => {
  const volume = usePlayerStore((state) => state.volume);
  
  // UI state
  const showVolumeIndicator = useUIStore((state) => state.showVolumeIndicator);
  const setShowVolumeIndicator = useUIStore((state) => state.setShowVolumeIndicator);

  useEffect(() => {
    if (showVolumeIndicator) {
      const timeout = setTimeout(() => setShowVolumeIndicator(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [showVolumeIndicator, setShowVolumeIndicator]);

  if (!showVolumeIndicator) return null;

  return (
    <View 
      className="absolute bottom-[100px] left-1/2 w-[200px] bg-dark/95 rounded-xl p-4 items-center z-30 border-2 border-accent"
      style={{ 
        transform: [{ translateX: -100 }],
        elevation: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
      }}
    >
      <Text className="text-[32px] mb-2">{volume === 0 ? '🔇' : '🔊'}</Text>
      <View className="w-full h-1.5 bg-subtle rounded-sm overflow-hidden mb-2">
        <View 
          className="h-full bg-accent rounded-sm"
          style={{ width: `${volume * 100}%` }}
        />
      </View>
      <Text className="text-white text-base font-semibold">{Math.round(volume * 100)}%</Text>
    </View>
  );
};

export default VolumeIndicator;
