import Toast from 'react-native-toast-message';

export const showError = (message: string, details?: string) => {
  Toast.show({
    type: 'error',
    text1: 'Error',
    text2: message,
    position: 'top',
    visibilityTime: 4000,
    topOffset: 60,
  });
  if (details) {
    console.error('Error details:', details);
  }
};

export const showSuccess = (message: string, details?: string) => {
  Toast.show({
    type: 'success',
    text1: 'Success',
    text2: message,
    position: 'top',
    visibilityTime: 3000,
    topOffset: 60,
  });
  if (details) {
    console.log('Success details:', details);
  }
};

export const showInfo = (message: string) => {
  Toast.show({
    type: 'info',
    text1: message,
    position: 'top',
    visibilityTime: 3000,
    topOffset: 60,
  });
};
