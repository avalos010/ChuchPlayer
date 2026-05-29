import { Platform } from 'react-native';

export const isTvLikePlatform = Platform.OS === 'android' || Platform.OS === 'web';
