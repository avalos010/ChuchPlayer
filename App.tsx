import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import AppNavigator from './src/navigation/AppNavigator';
import './global.css';
import { useDataRefreshScheduler } from './src/hooks/useDataRefreshScheduler';
import { useThemeStore } from './src/store/useThemeStore';

// Verify NativeWind installation
if (__DEV__) {
  try {
    const { verifyInstallation } = require('nativewind');
    verifyInstallation();
  } catch (e) {
    console.warn('NativeWind verification failed:', e);
  }
}

const App = () => {
  useDataRefreshScheduler();
  const loadPersistedTheme = useThemeStore((s) => s.loadPersistedTheme);
  useEffect(() => { loadPersistedTheme(); }, []);

  return (
    <GestureHandlerRootView className="flex-1 bg-dark">
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#1a1a1a" />
        <AppNavigator />
        <View className="absolute inset-0 z-[9999]" style={{ elevation: 9999 }} pointerEvents="box-none">
          <Toast />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
