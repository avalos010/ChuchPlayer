jest.mock('react-native', () => ({
  NativeModules: {},
  Platform: { OS: 'android' },
}));

import { resolveApkUrl } from '../appUpdater';

const remote = {
  versionCode: 10003,
  versionName: '1.0.3',
  apkUrls: {
    'arm64-v8a': 'https://example.com/arm64.apk',
    'armeabi-v7a': 'https://example.com/arm32.apk',
    x86: 'https://example.com/x86.apk',
    x86_64: 'https://example.com/x86_64.apk',
  },
};

describe('resolveApkUrl', () => {
  it('uses the device preferred ABI', () => {
    expect(resolveApkUrl(remote, ['arm64-v8a', 'armeabi-v7a'])).toBe('https://example.com/arm64.apk');
  });

  it('uses the first compatible fallback ABI', () => {
    expect(resolveApkUrl(remote, ['mips', 'armeabi-v7a'])).toBe('https://example.com/arm32.apk');
  });

  it('falls back to the legacy APK URL', () => {
    expect(resolveApkUrl({ ...remote, apkUrl: 'https://example.com/legacy.apk' }, ['mips']))
      .toBe('https://example.com/legacy.apk');
  });

  it('returns null when no APK supports the device', () => {
    expect(resolveApkUrl(remote, ['mips'])).toBeNull();
  });
});
