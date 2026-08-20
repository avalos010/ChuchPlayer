import { useUIStore } from '../useUIStore';

describe('useUIStore player controls', () => {
  beforeEach(() => {
    useUIStore.setState({
      showInfoBar: false,
      showControls: false,
      showEPG: false,
      showEPGGrid: false,
    });
  });

  it('keeps the horizontal controls open with the info bar', () => {
    useUIStore.getState().setShowControls(true);
    useUIStore.getState().setShowInfoBar(true);

    expect(useUIStore.getState().showInfoBar).toBe(true);
    expect(useUIStore.getState().showControls).toBe(true);
  });

  it('resets the control mode when the info bar closes', () => {
    useUIStore.setState({ showInfoBar: true, showControls: true });

    useUIStore.getState().setShowInfoBar(false);

    expect(useUIStore.getState().showInfoBar).toBe(false);
    expect(useUIStore.getState().showControls).toBe(false);
  });

  it('resets the control mode when all overlays close', () => {
    useUIStore.setState({ showInfoBar: true, showControls: true, showEPG: true });

    useUIStore.getState().closeAllOverlays();

    expect(useUIStore.getState().showInfoBar).toBe(false);
    expect(useUIStore.getState().showControls).toBe(false);
    expect(useUIStore.getState().showEPG).toBe(false);
  });
});
