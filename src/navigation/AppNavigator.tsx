import React, { useEffect, useState } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme, View, ActivityIndicator } from 'react-native';
import { RootStackParamList } from '../types';
import { getLastChannel, getPlaylists } from '../utils/storage';

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
        // First check if there are any playlists
        const playlists = await getPlaylists();
        if (playlists.length === 0) {
          console.log('No playlists found, starting on Settings screen');
          setInitialRoute('Settings');
          return;
        }

        // If playlists exist, check for last channel
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
        // On error, check playlists again
        try {
          const playlists = await getPlaylists();
          if (playlists.length === 0) {
            setInitialRoute('Settings');
          } else {
            setInitialRoute('Player');
          }
        } catch {
          setInitialRoute('Settings');
        }
      }
    };

    determineInitialRoute();
  }, []);

  if (!initialRoute) {
    // Show loading screen while determining initial route
    return (
      <View style={{ flex: 1, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00aaff" />
      </View>
    );
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
