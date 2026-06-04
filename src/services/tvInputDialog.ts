import { NativeModules, Platform } from 'react-native';

interface TvInputDialogOptions {
  title: string;
  value: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'url';
}

const { TvInputDialogModule } = NativeModules;

export const openTvInputDialog = async ({
  title,
  value,
  secureTextEntry = false,
  keyboardType = 'default',
}: TvInputDialogOptions): Promise<string | null> => {
  if (Platform.OS !== 'android' || !TvInputDialogModule) {
    throw new Error('TvInputDialogModule unavailable');
  }

  return TvInputDialogModule.promptText(title, value, secureTextEntry, keyboardType);
};
