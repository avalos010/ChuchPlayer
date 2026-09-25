const mockFocusItem = jest.fn();

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  ScrollView: 'ScrollView',
  StyleSheet: {
    absoluteFillObject: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: 'Text',
  View: 'View',
}));

jest.mock('expo-image', () => ({ Image: 'Image' }));

jest.mock('../../FocusableItem', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        getNativeNode: () => null,
        focus: () => mockFocusItem(props),
      }));
      return React.createElement('FocusableItem', props, props.children);
    }),
  };
});

jest.mock('../../../store/useThemeStore', () => ({
  useThemeStore: (selector: (state: any) => unknown) => selector({ theme: { accent: '#33aaff' } }),
}));

import React from 'react';
const renderer = require('react-test-renderer') as any;
const { act } = renderer;
import { GroupRail } from '../EpgGridParts';

describe('EPG group rail focus', () => {
  const originalRequestAnimationFrame = (globalThis as any).requestAnimationFrame;
  const originalCancelAnimationFrame = (globalThis as any).cancelAnimationFrame;

  beforeAll(() => {
    (globalThis as any).requestAnimationFrame = (callback: (time: number) => void) => {
      callback(0);
      return 1;
    };
    (globalThis as any).cancelAnimationFrame = jest.fn();
  });

  afterAll(() => {
    if (originalRequestAnimationFrame) {
      (globalThis as any).requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete (globalThis as any).requestAnimationFrame;
    }
    if (originalCancelAnimationFrame) {
      (globalThis as any).cancelAnimationFrame = originalCancelAnimationFrame;
    } else {
      delete (globalThis as any).cancelAnimationFrame;
    }
  });

  beforeEach(() => mockFocusItem.mockClear());

  it('focuses the first group even when a later group is selected', async () => {
    const onSelect = jest.fn();
    let tree: any;

    await act(async () => {
      tree = renderer.create(
        <GroupRail
          groups={[
            { name: 'All', count: 10 },
            { name: 'News', count: 4 },
            { name: 'Sports', count: 2 },
          ]}
          selectedGroup="Sports"
          onSelect={onSelect}
          onClose={jest.fn()}
        />,
      );
    });

    const preferredItems = tree.root
      .findAllByType('FocusableItem')
      .filter((item: any) => typeof item.props.hasTVPreferredFocus === 'boolean');

    expect(preferredItems.map((item: any) => item.props.hasTVPreferredFocus)).toEqual([true, false, false]);
    expect(mockFocusItem).toHaveBeenCalledTimes(1);
    mockFocusItem.mock.calls[0][0].onPress();
    expect(onSelect).toHaveBeenCalledWith('All');

    await act(async () => tree.unmount());
  });
});
