import {
  DEFAULT_INTERFACE_PREFERENCES,
  getInterfacePreferencesFromSettings,
} from '../shared';

describe('interface preferences', () => {
  it('uses defaults when values are missing', () => {
    expect(getInterfacePreferencesFromSettings({})).toEqual(
      DEFAULT_INTERFACE_PREFERENCES,
    );
  });

  it('picks interface-facing settings from saved settings', () => {
    expect(
      getInterfacePreferencesFromSettings({
        showEPG: true,
        infoBarTimeoutSeconds: 10,
        showChannelNumbers: true,
        clockFormat: '12h',
      }),
    ).toEqual({
      showEPG: true,
      infoBarTimeoutSeconds: 10,
      showChannelNumbers: true,
      clockFormat: '12h',
    });
  });
});
