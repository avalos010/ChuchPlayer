import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from 'react-native';
import { RootStackParamList } from '../types';

import HomeScreen from '../screens/HomeScreen';
import ChannelsScreen from '../screens/ChannelsScreen';
import PlayerScreen from '../screens/PlayerScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const colorScheme = useColorScheme();

  return (
    <NavigationContainer theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack.Navigator
        initialRouteName="Home"
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
          name="Home"
          component={HomeScreen}
          options={{ title: 'chuchPlayer' }}
        />
        <Stack.Screen
          name="Channels"
          component={ChannelsScreen}
          options={{ title: 'Channels' }}
        />
        <Stack.Screen
          name="Player"
          component={PlayerScreen}
          options={{ headerShown: false }}
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
