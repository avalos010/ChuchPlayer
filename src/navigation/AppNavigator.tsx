import React, { useEffect, useState } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from 'react-native';
import { RootStackParamList } from '../types';
import { getLastChannel } from '../utils/storage';

import PlayerScreen from '../screens/PlayerScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const colorScheme = useColorScheme();
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  const [initialChannel, setInitialChannel] = useState<any>(null);

  useEffect(() => {
    const determineInitialRoute = async () => {
      try {
        const lastChannel = await getLastChannel();
        if (lastChannel) {
          console.log('Found last channel, starting on PlayerScreen:', lastChannel.name);
          setInitialChannel(lastChannel);
          setInitialRoute('Player');
        } else {
          console.log('No last channel found, starting on PlayerScreen');
          setInitialRoute('Player');
        }
      } catch (error) {
        console.error('Error determining initial route:', error);
        setInitialRoute('Player');
      }
    };

    determineInitialRoute();
  }, []);

  if (!initialRoute) {
    // Show nothing while determining initial route
    return null;
  }

  return (
    <NavigationContainer theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1a1a1a',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen
          name="Player"
          component={PlayerScreen}
          options={{ headerShown: false }}
          initialParams={initialChannel ? { channel: initialChannel } : { channel: undefined }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Settings' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
