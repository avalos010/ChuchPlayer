import React from 'react';
import { View, Text, Modal, FlatList } from 'react-native';
import FocusableItem from '../FocusableItem';
import { Channel } from '../../types';
import { useMultiScreenStore } from '../../store/useMultiScreenStore';

interface MultiScreenControlsProps {
  channels: Channel[];
  onChannelSelect: (channel: Channel) => void;
  isVisible: boolean;
  onClose: () => void;
}

const MultiScreenControls: React.FC<MultiScreenControlsProps> = ({
  channels,
  onChannelSelect,
  isVisible,
  onClose,
}) => {
  const {
    screens,
    addScreen,
    removeScreen,
    setFocusedScreen,
    setLayout,
    layout,
    getScreenCount,
    canAddScreen,
    toggleMultiScreenMode,
    isMultiScreenMode,
    maxScreens,
  } = useMultiScreenStore();

  const handleAddScreen = (channel: Channel) => {
    addScreen(channel);
    onChannelSelect(channel);
    onClose();
  };

  const handleEnterMultiScreen = () => {
    if (screens.length === 0) {
      // Add current channel as first screen
      const currentChannel = channels[0];
      if (currentChannel) {
        addScreen(currentChannel);
      }
    }
    toggleMultiScreenMode();
  };

  const handleExitMultiScreen = () => {
    toggleMultiScreenMode();
    onClose();
  };

  const availableChannels = channels.filter(
    ch => !screens.some(s => s.channel.id === ch.id)
  );

  if (!isVisible) return null;

  return (
    <Modal visible={isVisible} transparent animationType="fade">
      <View className="flex-1 bg-black/80 justify-center items-center p-4">
        <View className="bg-card rounded-xl p-6 w-[90%] max-w-[600px] gap-4">
          <Text className="text-white text-2xl font-bold mb-4">Multi-Screen Mode</Text>

          {!isMultiScreenMode ? (
            <View className="gap-4">
              <Text className="text-text-muted text-base">
                Watch multiple channels simultaneously. Add up to 4 screens.
              </Text>
              <FocusableItem
                onPress={handleEnterMultiScreen}
                className="bg-accent px-6 py-4 rounded-lg items-center"
              >
                <Text className="text-white text-lg font-semibold">Enter Multi-Screen Mode</Text>
              </FocusableItem>
            </View>
          ) : (
            <View className="gap-4">
              {/* Current screens */}
              <View className="gap-2">
                <Text className="text-white text-lg font-semibold">Active Screens ({getScreenCount()}/{maxScreens})</Text>
                {screens.map((screen) => (
                  <View
                    key={screen.id}
                    className="flex-row justify-between items-center bg-subtle p-3 rounded-lg"
                  >
                    <Text className="text-white flex-1" numberOfLines={1}>
                      {screen.channel.name}
                    </Text>
                    <FocusableItem
                      onPress={() => removeScreen(screen.id)}
                      className="bg-red-600 px-3 py-1 rounded"
                    >
                      <Text className="text-white text-sm">Remove</Text>
                    </FocusableItem>
                  </View>
                ))}
              </View>

              {/* Add new screen */}
              {canAddScreen() && (
                <View className="gap-2">
                  <Text className="text-white text-lg font-semibold">Add Screen</Text>
                  <View className="max-h-[300px]">
                    <FlatList
                      data={availableChannels}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => (
                        <FocusableItem
                          onPress={() => handleAddScreen(item)}
                          className="bg-subtle p-3 rounded-lg mb-2"
                        >
                          <Text className="text-white">{item.name}</Text>
                        </FocusableItem>
                      )}
                    />
                  </View>
                </View>
              )}

              {/* Layout options */}
              <View className="gap-2">
                <Text className="text-white text-lg font-semibold">Layout</Text>
                <View className="flex-row gap-2">
                  <FocusableItem
                    onPress={() => setLayout('grid')}
                    className={`flex-1 py-3 rounded-lg items-center ${
                      layout === 'grid' ? 'bg-accent' : 'bg-subtle'
                    }`}
                  >
                    <Text
                      className={`text-base font-semibold ${
                        layout === 'grid' ? 'text-white' : 'text-gray-300'
                      }`}
                    >
                      Grid (2x2)
                    </Text>
                  </FocusableItem>
                  <FocusableItem
                    onPress={() => setLayout('split')}
                    className={`flex-1 py-3 rounded-lg items-center ${
                      layout === 'split' ? 'bg-accent' : 'bg-subtle'
                    }`}
                  >
                    <Text
                      className={`text-base font-semibold ${
                        layout === 'split' ? 'text-white' : 'text-gray-300'
                      }`}
                    >
                      Split
                    </Text>
                  </FocusableItem>
                </View>
              </View>

              {/* Exit button */}
              <FocusableItem
                onPress={handleExitMultiScreen}
                className="bg-[#4a4a4a] px-6 py-4 rounded-lg items-center"
              >
                <Text className="text-white text-lg font-semibold">Exit Multi-Screen Mode</Text>
              </FocusableItem>
            </View>
          )}

          {/* Close button */}
          <FocusableItem
            onPress={onClose}
            className="bg-[#4a4a4a] px-6 py-3 rounded-lg items-center mt-2"
          >
            <Text className="text-white text-base font-semibold">Close</Text>
          </FocusableItem>
        </View>
      </View>
    </Modal>
  );
};

export default MultiScreenControls;

