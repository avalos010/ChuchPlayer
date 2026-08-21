import AsyncStorage from '@react-native-async-storage/async-storage';

export const playlistStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
  multiGet: (keys: string[]) => AsyncStorage.multiGet(keys),
  multiSet: (entries: [string, string][]) => AsyncStorage.multiSet(entries),
  multiRemove: (keys: string[]) => AsyncStorage.multiRemove(keys),
};
