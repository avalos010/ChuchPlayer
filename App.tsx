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
import { useAppUpdater } from './src/hooks/useAppUpdater';
import AppUpdateDialog from './src/components/AppUpdateDialog';

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
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => { loadPersistedTheme(); }, []);

  const { state: updateState, startUpdate, dismiss } = useAppUpdater();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.bg }}>
      <SafeAreaProvider>
        <StatusBar style={theme.accentText === '#111111' ? 'dark' : 'light'} backgroundColor={theme.bg} />
        <AppNavigator />
        <View className="absolute inset-0 z-[9999]" style={{ elevation: 9999 }} pointerEvents="box-none">
          <Toast />
        </View>
        {(updateState.phase === 'available' || updateState.phase === 'downloading') && (
          <AppUpdateDialog
            visible
            versionName={updateState.remote.versionName}
            releaseNotes={updateState.remote.releaseNotes}
            progress={updateState.phase === 'downloading' ? updateState.progress : null}
            onUpdate={startUpdate}
            onDismiss={dismiss}
          />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
