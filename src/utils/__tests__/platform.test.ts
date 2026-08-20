jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Platform: { OS: 'web' },
}));

import { confirmAction } from '../platform';

const originalConfirm = globalThis.confirm;
const confirmMock = jest.fn();

beforeAll(() => {
  globalThis.confirm = confirmMock;
});

afterAll(() => {
  globalThis.confirm = originalConfirm;
});

beforeEach(() => {
  confirmMock.mockReset();
});

describe('confirmAction on web', () => {
  it('runs the action when the browser confirmation is accepted', () => {
    const onConfirm = jest.fn();
    confirmMock.mockReturnValue(true);

    confirmAction({
      title: 'Delete Playlist',
      message: 'Delete "News"?',
      confirmLabel: 'Delete',
      onConfirm,
    });

    expect(confirmMock).toHaveBeenCalledWith('Delete Playlist\n\nDelete "News"?');
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('keeps the playlist when the browser confirmation is cancelled', () => {
    const onConfirm = jest.fn();
    confirmMock.mockReturnValue(false);

    confirmAction({
      title: 'Delete Playlist',
      message: 'Delete "News"?',
      confirmLabel: 'Delete',
      onConfirm,
    });

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
