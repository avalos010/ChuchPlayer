import { Channel } from '../../types';
import { useMultiScreenStore } from '../useMultiScreenStore';

const makeChannel = (id: string, name = `Channel ${id}`): Channel => ({
  id,
  name,
  url: `https://stream.example.com/${id}.m3u8`,
});

const reset = () =>
  useMultiScreenStore.setState({
    screens: [],
    isMultiScreenMode: false,
    maxScreens: 4,
    layout: 'grid',
    featuredScreenId: null,
    fullscreenScreenId: null,
  });

beforeEach(reset);

describe('addScreen', () => {
  it('adds a screen and enters multi-screen mode', () => {
    useMultiScreenStore.getState().addScreen(makeChannel('a'));
    const { screens, isMultiScreenMode } = useMultiScreenStore.getState();
    expect(screens).toHaveLength(1);
    expect(screens[0].channel.id).toBe('a');
    expect(isMultiScreenMode).toBe(true);
  });

  it('focuses the first screen added', () => {
    useMultiScreenStore.getState().addScreen(makeChannel('a'));
    const { screens } = useMultiScreenStore.getState();
    expect(screens[0].isFocused).toBe(true);
  });

  it('ignores duplicate channels', () => {
    const { addScreen } = useMultiScreenStore.getState();
    addScreen(makeChannel('a'));
    addScreen(makeChannel('a'));
    expect(useMultiScreenStore.getState().screens).toHaveLength(1);
  });

  it('does not exceed maxScreens', () => {
    const { addScreen } = useMultiScreenStore.getState();
    ['a', 'b', 'c', 'd', 'e'].forEach((id) => addScreen(makeChannel(id)));
    expect(useMultiScreenStore.getState().screens).toHaveLength(4);
  });
});

describe('setScreenChannel', () => {
  it('replaces the channel on a specific screen and keeps it playing', () => {
    const { addScreen, setScreenChannel } = useMultiScreenStore.getState();
    addScreen(makeChannel('a'));
    const screenId = useMultiScreenStore.getState().screens[0].id;

    setScreenChannel(screenId, makeChannel('z', 'New Channel'));

    const screen = useMultiScreenStore.getState().screens[0];
    expect(screen.channel.id).toBe('z');
    expect(screen.channel.name).toBe('New Channel');
    expect(screen.isPlaying).toBe(true);
  });
});

describe('featured screen', () => {
  it('sets and resets the featured screen', () => {
    const { addScreen, setFeaturedScreen } = useMultiScreenStore.getState();
    addScreen(makeChannel('a'));
    addScreen(makeChannel('b'));
    const id = useMultiScreenStore.getState().screens[0].id;

    setFeaturedScreen(id);
    expect(useMultiScreenStore.getState().featuredScreenId).toBe(id);

    setFeaturedScreen(null);
    expect(useMultiScreenStore.getState().featuredScreenId).toBeNull();
  });

  it('clears the featured screen when the layout changes', () => {
    const { addScreen, setFeaturedScreen, setLayout } = useMultiScreenStore.getState();
    addScreen(makeChannel('a'));
    setFeaturedScreen(useMultiScreenStore.getState().screens[0].id);

    setLayout('split');
    expect(useMultiScreenStore.getState().featuredScreenId).toBeNull();
    expect(useMultiScreenStore.getState().layout).toBe('split');
  });
});

describe('fullscreen', () => {
  it('sets the fullscreen screen and focuses it', () => {
    const { addScreen, setFullscreenScreen } = useMultiScreenStore.getState();
    addScreen(makeChannel('a'));
    addScreen(makeChannel('b'));
    const second = useMultiScreenStore.getState().screens[1].id;

    setFullscreenScreen(second);
    const { fullscreenScreenId, screens } = useMultiScreenStore.getState();
    expect(fullscreenScreenId).toBe(second);
    expect(screens.find((s) => s.isFocused)?.id).toBe(second);
  });

  it('cycleFullscreen advances to the next screen and wraps around', () => {
    const { addScreen, cycleFullscreen } = useMultiScreenStore.getState();
    addScreen(makeChannel('a'));
    addScreen(makeChannel('b'));
    addScreen(makeChannel('c'));
    const ids = useMultiScreenStore.getState().screens.map((s) => s.id);

    // anchor is the focused (first) screen → cycles to second
    cycleFullscreen();
    expect(useMultiScreenStore.getState().fullscreenScreenId).toBe(ids[1]);

    cycleFullscreen();
    expect(useMultiScreenStore.getState().fullscreenScreenId).toBe(ids[2]);

    // wraps back to the first
    cycleFullscreen();
    expect(useMultiScreenStore.getState().fullscreenScreenId).toBe(ids[0]);
  });
});

describe('removeScreen', () => {
  it('clears featured/fullscreen when the removed screen held them', () => {
    const { addScreen, setFeaturedScreen, setFullscreenScreen, removeScreen } =
      useMultiScreenStore.getState();
    addScreen(makeChannel('a'));
    addScreen(makeChannel('b'));
    const target = useMultiScreenStore.getState().screens[0].id;

    setFeaturedScreen(target);
    setFullscreenScreen(target);
    removeScreen(target);

    const state = useMultiScreenStore.getState();
    expect(state.screens.find((s) => s.id === target)).toBeUndefined();
    expect(state.featuredScreenId).toBeNull();
    expect(state.fullscreenScreenId).toBeNull();
  });

  it('leaves multi-screen mode when only one screen remains', () => {
    const { addScreen, removeScreen } = useMultiScreenStore.getState();
    addScreen(makeChannel('a'));
    addScreen(makeChannel('b'));
    removeScreen(useMultiScreenStore.getState().screens[1].id);
    expect(useMultiScreenStore.getState().isMultiScreenMode).toBe(false);
  });
});

describe('clearAllScreens', () => {
  it('resets all multi-screen state', () => {
    const { addScreen, setFeaturedScreen, clearAllScreens } = useMultiScreenStore.getState();
    addScreen(makeChannel('a'));
    setFeaturedScreen(useMultiScreenStore.getState().screens[0].id);

    clearAllScreens();
    const state = useMultiScreenStore.getState();
    expect(state.screens).toHaveLength(0);
    expect(state.isMultiScreenMode).toBe(false);
    expect(state.featuredScreenId).toBeNull();
    expect(state.fullscreenScreenId).toBeNull();
  });
});
