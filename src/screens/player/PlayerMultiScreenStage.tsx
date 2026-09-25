import React from 'react';
import { Dimensions, Platform, View } from 'react-native';
import { Channel } from '../../types';
import MultiScreenView from '../../components/player/MultiScreenView';
import MultiScreenControls from '../../components/player/MultiScreenControls';

interface PlayerMultiScreenStageProps {
  channels: Channel[];
  showControls: boolean;
  onCloseControls: () => void;
  onOpenControls: () => void;
}

const PlayerMultiScreenStage: React.FC<PlayerMultiScreenStageProps> = ({
  channels,
  showControls,
  onCloseControls,
  onOpenControls,
}) => {
  const { width, height } = Dimensions.get('window');

  return (
    <View
      className="flex-1 bg-black w-full h-full absolute inset-0"
      style={
        Platform.OS === 'web'
          ? ({
              width,
              height,
              minHeight: height,
            } as any)
          : undefined
      }
    >
      <MultiScreenView channels={channels} onOpenControls={onOpenControls} />
      <MultiScreenControls
        channels={channels}
        isVisible={showControls}
        onClose={onCloseControls}
      />
    </View>
  );
};

export default PlayerMultiScreenStage;
