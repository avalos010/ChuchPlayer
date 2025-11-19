// Why Did You Render setup for React Native
// This helps identify unnecessary re-renders

if (__DEV__) {
  const React = require('react');
  
  // Only enable in development
  if (typeof window !== 'undefined') {
    const whyDidYouRender = require('@welldone-software/why-did-you-render');
    whyDidYouRender(React, {
      trackAllPureComponents: false, // Only track components with whyDidYouRender = true
      trackHooks: true, // Track hook changes
      logOnDifferentValues: true, // Log when values change
      collapseGroups: true, // Collapse groups in console
      trackExtraHooks: [
        // Track Zustand hooks
        [require('zustand'), 'usePlayerStore', 'useUIStore', 'useEPGStore', 'useMultiScreenStore'],
      ],
    });
  }
}

