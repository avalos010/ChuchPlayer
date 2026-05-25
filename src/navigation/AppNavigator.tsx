import React, { useEffect, useMemo, useState } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, Platform } from 'react-native';
import { RootStackParamList } from '../types';
import { getLastChannel, getPlaylists } from '../utils/storage';
import { useThemeStore } from '../store/useThemeStore';

import PlayerScreen from '../screens/PlayerScreen';
import WebPlayerScreen from '../screens/WebPlayerScreen';
import SettingsScreen from '../screens/SettingsScreen';

const ActivePlayerScreen = Platform.OS === 'web' ? WebPlayerScreen : PlayerScreen;

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const theme = useThemeStore((state) => state.theme);
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  const [initialChannel, setInitialChannel] = useState<any>(null);
  const navigationTheme = useMemo(() => ({
    ...DefaultTheme,
    dark: theme.bg !== '#f0f0f0',
    colors: {
      ...DefaultTheme.colors,
      primary: theme.accent,
      background: theme.bg,
      card: theme.surface,
      text: theme.text,
      border: theme.border,
      notification: theme.live,
    },
  }), [theme]);

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
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.surface,
          },
          headerTintColor: theme.text,
          headerTitleStyle: {
            fontWeight: 'bold',
            color: theme.text,
          },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen
          name="Player"
          component={ActivePlayerScreen}
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
