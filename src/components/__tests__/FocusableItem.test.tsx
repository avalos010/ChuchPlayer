jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Pressable: 'Pressable',
  View: 'View',
  findNodeHandle: () => 42,
}));

import React from 'react';
import FocusableItem, { type FocusableItemHandle } from '../FocusableItem';

const { act, create } = require('react-test-renderer');

describe('FocusableItem TV focus', () => {
  let tree: any;
  const nativeProps = jest.fn();
  const ref = React.createRef<FocusableItemHandle>();
  const renderItem = (preferred: boolean, label = 'Control') => (
    <FocusableItem ref={ref} onPress={() => {}} hasTVPreferredFocus={preferred}>
      {label}
    </FocusableItem>
  );
  const item = () => tree.root.findByType('Pressable');

  beforeEach(() => nativeProps.mockClear());

  afterEach(async () => {
    if (tree) await act(() => tree.unmount());
    tree = null;
  });

  const mount = async (preferred: boolean) => {
    await act(() => {
      tree = create(renderItem(preferred), {
        createNodeMock: () => ({ setNativeProps: nativeProps }),
      });
    });
  };

  it('keeps initial focus from returning after focus moves away and the item repaints', async () => {
    await mount(true);
    expect(item().props.hasTVPreferredFocus).toBe(true);

    await act(() => item().props.onFocus());
    await act(() => item().props.onBlur());
    await act(() => tree.update(renderItem(true, 'Updated control')));

    expect(item().props.hasTVPreferredFocus).toBe(false);
  });

  it('honors a new preferred focus request after the prop changes', async () => {
    await mount(true);
    await act(() => item().props.onFocus());
    await act(() => tree.update(renderItem(false)));
    await act(() => tree.update(renderItem(true)));

    expect(item().props.hasTVPreferredFocus).toBe(true);
  });

  it('allows repeated Android focus requests after leaving the item', async () => {
    await mount(false);
    await act(() => ref.current?.focus());
    await act(() => item().props.onFocus());
    await act(() => item().props.onBlur());
    await act(() => ref.current?.focus());

    expect(nativeProps.mock.calls.map(([props]) => props.hasTVPreferredFocus))
      .toEqual([true, false, true]);
  });
});
