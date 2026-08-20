import { Alert, Platform } from 'react-native';

export const isTvLikePlatform = Platform.OS === 'android' || Platform.OS === 'web';

interface ConfirmActionOptions {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
}

export const confirmAction = ({
  title,
  message,
  confirmLabel,
  onConfirm,
}: ConfirmActionOptions): void => {
  if (Platform.OS === 'web') {
    if (globalThis.confirm(`${title}\n\n${message}`)) void onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
};
