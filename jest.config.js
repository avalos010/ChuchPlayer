module.exports = {
  preset: 'jest-expo',
  setupFilesAfterFramework: ['@testing-library/react-native/extend-expect'],
  setupFiles: ['./jest.setup.js'],
  moduleNameMapper: {
    '^realm$': '<rootDir>/__mocks__/realm.js',
    '^react-native-keyevent$': '<rootDir>/__mocks__/keyevent.js',
  },
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@shopify/flash-list|nativewind)/)',
  ],
};
