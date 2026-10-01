import type { ReactElement, ReactNode } from 'react';

interface FocusableTestProps {
  children?: ReactNode;
  hasTVPreferredFocus?: boolean;
  onFocus?: () => void;
  onPress: () => void;
}

interface TestNode {
  props: FocusableTestProps;
  findAllByType: (type: string) => TestNode[];
}

interface TestTree {
  root: TestNode;
  update: (element: ReactElement) => void;
  unmount: () => void;
}

const mockFocusRequest = jest.fn<void, []>();

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
  const React = require('react') as typeof import('react');
  return {
    __esModule: true,
    default: (props: FocusableTestProps) => {
      React.useEffect(() => {
        if (props.hasTVPreferredFocus) mockFocusRequest();
      }, [props.hasTVPreferredFocus]);
      return React.createElement('FocusableItem', props, props.children);
    },
  };
});

jest.mock('../../../store/useThemeStore', () => ({
  useThemeStore: (selector: (state: { theme: { accent: string } }) => unknown) =>
    selector({ theme: { accent: '#33aaff' } }),
}));

import React from 'react';
const renderer = require('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => Promise<void>;
  create: (element: ReactElement) => TestTree;
};
const { act } = renderer;
import { GroupRail } from '../EpgGridParts';

const groups = [
  { name: 'All', count: 10 },
  { name: 'News', count: 4 },
  { name: 'Sports', count: 2 },
];

const groupItems = (tree: TestTree) => tree.root
  .findAllByType('FocusableItem')
  .filter((item) => typeof item.props.hasTVPreferredFocus === 'boolean');

const renderRail = (onSelect = jest.fn(), items = groups) => (
  <GroupRail groups={items} selectedGroup="Sports" onSelect={onSelect} onClose={jest.fn()} />
);

describe('EPG group rail focus', () => {
  const originalRequestAnimationFrame = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
  const originalCancelAnimationFrame = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame');
  let tree: TestTree;

  beforeAll(() => {
    globalThis.requestAnimationFrame = (callback) => {
      callback(0);
      return 1;
    };
    globalThis.cancelAnimationFrame = jest.fn();
  });

  afterAll(() => {
    for (const [name, descriptor] of [
      ['requestAnimationFrame', originalRequestAnimationFrame],
      ['cancelAnimationFrame', originalCancelAnimationFrame],
    ] as const) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  });

  beforeEach(() => mockFocusRequest.mockClear());
  afterEach(async () => {
    await act(() => tree.unmount());
    jest.restoreAllMocks();
  });

  it('requests initial focus only after the opening frame', async () => {
    let pendingFrame: FrameRequestCallback | undefined;
    jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementationOnce((callback) => {
      pendingFrame = callback;
      return 1;
    });
    await act(() => { tree = renderer.create(renderRail()); });

    expect(groupItems(tree).every((item) => !item.props.hasTVPreferredFocus)).toBe(true);
    expect(mockFocusRequest).not.toHaveBeenCalled();

    await act(() => { pendingFrame?.(0); });

    expect(groupItems(tree).map((item) => item.props.hasTVPreferredFocus)).toEqual([true, false, false]);
    expect(mockFocusRequest).toHaveBeenCalledTimes(1);
  });

  it('focuses the first group even when a later group is selected', async () => {
    const onSelect = jest.fn();
    await act(() => { tree = renderer.create(renderRail(onSelect)); });

    expect(groupItems(tree).map((item) => item.props.hasTVPreferredFocus)).toEqual([true, false, false]);
    expect(mockFocusRequest).toHaveBeenCalledTimes(1);
    groupItems(tree)[0].props.onPress();
    expect(onSelect).toHaveBeenCalledWith('All');
  });

  it('clears preferred focus after entering the list so Down can leave the first item', async () => {
    await act(() => { tree = renderer.create(renderRail()); });
    await act(() => { groupItems(tree)[0].props.onFocus?.(); });

    expect(groupItems(tree).map((item) => item.props.hasTVPreferredFocus)).toEqual([false, false, false]);
    expect(mockFocusRequest).toHaveBeenCalledTimes(1);
  });

  it('does not request the first item again when the groups update while browsing', async () => {
    const onSelect = jest.fn();
    await act(() => { tree = renderer.create(renderRail(onSelect)); });
    await act(() => { groupItems(tree)[0].props.onFocus?.(); });
    await act(() => { tree.update(renderRail(onSelect, groups.map((group) => ({ ...group, count: group.count + 1 })))); });

    expect(groupItems(tree).every((item) => !item.props.hasTVPreferredFocus)).toBe(true);
    expect(mockFocusRequest).toHaveBeenCalledTimes(1);
    groupItems(tree)[1].props.onPress();
    expect(onSelect).toHaveBeenCalledWith('News');
  });

  it('starts at the first group again after closing and reopening the rail', async () => {
    await act(() => { tree = renderer.create(renderRail()); });
    await act(() => { groupItems(tree)[0].props.onFocus?.(); });
    await act(() => tree.unmount());
    await act(() => { tree = renderer.create(renderRail()); });

    expect(groupItems(tree).map((item) => item.props.hasTVPreferredFocus)).toEqual([true, false, false]);
    expect(mockFocusRequest).toHaveBeenCalledTimes(2);
  });
});
