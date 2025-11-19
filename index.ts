import { registerRootComponent } from 'expo';

// Enable why-did-you-render in development
if (__DEV__) {
  require('./src/utils/whyDidYouRender');
}

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
