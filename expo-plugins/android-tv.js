const { withAndroidManifest } = require('@expo/config-plugins');

const withAndroidTv = config => {
  return withAndroidManifest(config, configMod => {
    const { modResults } = configMod;
    const manifest = modResults.manifest;

    if (!manifest.application?.[0]) {
      return configMod;
    }

    const mainApplication = manifest.application[0];
    const activities = mainApplication.activity ?? [];
    const mainActivity = activities.find(activity => activity.$['android:name'] === '.MainActivity');

    if (mainActivity) {
      const intentFilters = mainActivity['intent-filter'] ?? [];
      const mainIntentFilter = intentFilters.find(filter =>
        filter.action?.some(action => action.$['android:name'] === 'android.intent.action.MAIN')
      );

      if (mainIntentFilter) {
        const categories = mainIntentFilter.category ?? [];
        const hasLeanback = categories.some(
          category => category.$['android:name'] === 'android.intent.category.LEANBACK_LAUNCHER'
        );

        if (!hasLeanback) {
          categories.push({
            $: { 'android:name': 'android.intent.category.LEANBACK_LAUNCHER' },
          });
          mainIntentFilter.category = categories;
        }
      }
    }

    manifest['uses-feature'] = manifest['uses-feature'] ?? [];

    const ensureFeature = (name, required) => {
      const exists = manifest['uses-feature'].some(feature => feature.$['android:name'] === name);
      if (!exists) {
        manifest['uses-feature'].push({
          $: {
            'android:name': name,
            ...(required !== undefined ? { 'android:required': required ? 'true' : 'false' } : {}),
          },
        });
      }
    };

    ensureFeature('android.software.leanback', true);
    ensureFeature('android.hardware.touchscreen', false);

    return configMod;
  });
};

module.exports = withAndroidTv;

