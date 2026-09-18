import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

export const VERSION_URL =
  'https://raw.githubusercontent.com/avalos010/ChuchPlayer/main/version.json';

export interface RemoteVersion {
  versionCode: number;
  versionName: string;
  apkUrl?: string;
  apkUrls?: Record<string, string>;
  releaseNotes?: string;
}

const { AppUpdaterModule } = NativeModules;

export const getInstalledVersionCode = (): Promise<number> => {
  if (Platform.OS !== 'android' || !AppUpdaterModule) return Promise.resolve(0);
  return AppUpdaterModule.getVersionCode();
};

export const getSupportedAbis = (): Promise<string[]> => {
  if (Platform.OS !== 'android' || !AppUpdaterModule) return Promise.resolve([]);
  return AppUpdaterModule.getSupportedAbis();
};

export const fetchRemoteVersion = async (url: string): Promise<RemoteVersion> => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`version fetch failed: ${res.status}`);
  return res.json();
};

export const downloadAndInstall = (apkUrl: string): Promise<void> => {
  if (!AppUpdaterModule) return Promise.reject(new Error('AppUpdaterModule unavailable'));
  return AppUpdaterModule.downloadAndInstall(apkUrl);
};

export const resolveApkUrl = (remote: RemoteVersion, supportedAbis: string[]): string | null => {
  for (const abi of supportedAbis) {
    const url = remote.apkUrls?.[abi];
    if (url) return url;
  }
  return remote.apkUrl ?? null;
};

export const createProgressEmitter = () => {
  if (!AppUpdaterModule) return null;
  return new NativeEventEmitter(AppUpdaterModule);
};
