jest.mock('react-native', () => ({
  DeviceEventEmitter: { addListener: jest.fn() },
  NativeModules: {},
  Platform: { OS: 'web' },
  requireNativeComponent: () => {
    throw new Error('requireNativeComponent is unavailable on web');
  },
}));

describe('ExoPlayerVideoView on web', () => {
  it('loads without registering the Android native view', () => {
    expect(() => require('../ExoPlayerVideoView')).not.toThrow();
  });
});
