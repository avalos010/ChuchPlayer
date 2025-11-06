import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';

const ChannelNumberPad: React.FC = () => {
  const channelNumberInput = usePlayerStore((state) => state.channelNumberInput);
  const setChannelNumberInput = usePlayerStore((state) => state.setChannelNumberInput);
  
  // UI state
  const showChannelNumberPad = useUIStore((state) => state.showChannelNumberPad);
  const setShowChannelNumberPad = useUIStore((state) => state.setShowChannelNumberPad);
  const channels = usePlayerStore((state) => state.channels);

  const channelNum = channelNumberInput ? parseInt(channelNumberInput, 10) : null;
  const totalChannels = channels.length;

  // Auto-hide after timeout
  useEffect(() => {
    if (showChannelNumberPad) {
      const timeout = setTimeout(() => {
        setShowChannelNumberPad(false);
        setChannelNumberInput('');
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [showChannelNumberPad, setShowChannelNumberPad, setChannelNumberInput]);

  if (!showChannelNumberPad) return null;

  return (
    <View 
      className="absolute top-[40%] left-1/2 w-[300px] bg-dark/95 rounded-2xl p-6 items-center z-30 border-2 border-accent"
      style={{ 
        transform: [{ translateX: -150 }],
        elevation: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
      }}
    >
      <View className="items-center gap-3">
        <Text className="text-text-muted text-sm font-medium uppercase tracking-wider">
          Channel Number
        </Text>
        <Text className="text-white text-[48px] font-bold tracking-widest" style={{ fontFamily: 'monospace' }}>
          {channelNumberInput || 'Enter channel number'}
        </Text>
        {channelNum && channelNum > 0 && channelNum <= totalChannels && (
          <Text className="text-accent text-sm font-semibold">
            Channel: {channelNum} / {totalChannels}
          </Text>
        )}
      </View>
    </View>
  );
};

export default ChannelNumberPad;
