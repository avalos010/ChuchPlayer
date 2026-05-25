// react-native-keyevent is an Android-native module — stub it out for Jest
module.exports = {
  onKeyDownListener: jest.fn(),
  onKeyUpListener: jest.fn(),
  onKeyMultipleListener: jest.fn(),
  removeKeyDownListener: jest.fn(),
  removeKeyUpListener: jest.fn(),
  removeKeyMultipleListener: jest.fn(),
};
