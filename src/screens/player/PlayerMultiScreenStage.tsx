import React from 'react';
import { Dimensions, Platform, View } from 'react-native';
import { Channel } from '../../types';
import MultiScreenView from '../../components/player/MultiScreenView';
import MultiScreenControls from '../../components/player/MultiScreenControls';

interface PlayerMultiScreenStageProps {
  channels: Channel[];
  onChannelSelect: (channel: Channel) => void;
  showControls: boolean;
  onCloseControls: () => void;
}

const PlayerMultiScreenStage: React.FC<PlayerMultiScreenStageProps> = ({
  channels,
  onChannelSelect,
  showControls,
  onCloseControls,
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
      <MultiScreenView channels={channels} onChannelSelect={onChannelSelect} />
      <MultiScreenControls
        channels={channels}
        onChannelSelect={onChannelSelect}
        isVisible={showControls}
        onClose={onCloseControls}
      />
    </View>
  );
};

export default PlayerMultiScreenStage;
