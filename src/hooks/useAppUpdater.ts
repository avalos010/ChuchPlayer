import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  VERSION_URL,
  RemoteVersion,
  fetchRemoteVersion,
  getInstalledVersionCode,
  downloadAndInstall,
  createProgressEmitter,
} from '../services/appUpdater';

type State =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'available'; remote: RemoteVersion }
  | { phase: 'downloading'; remote: RemoteVersion; progress: number }
  | { phase: 'error'; message: string };

export const useAppUpdater = () => {
  const [state, setState] = useState<State>({ phase: 'idle' });
  const checkedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'android' || checkedRef.current) return;
    checkedRef.current = true;

    (async () => {
      setState({ phase: 'checking' });
      try {
        const [remote, installed] = await Promise.all([
          fetchRemoteVersion(VERSION_URL),
          getInstalledVersionCode(),
        ]);
        if (remote.versionCode > installed) {
          setState({ phase: 'available', remote });
        } else {
          setState({ phase: 'idle' });
        }
      } catch {
        setState({ phase: 'idle' }); // silent — don't block the app on network failure
      }
    })();
  }, []);

  const startUpdate = async () => {
    if (state.phase !== 'available') return;
    const { remote } = state;
    setState({ phase: 'downloading', remote, progress: 0 });

    const emitter = createProgressEmitter();
    const sub = emitter?.addListener('APP_UPDATE_PROGRESS', (pct: number) => {
      setState((s) =>
        s.phase === 'downloading' ? { ...s, progress: pct } : s,
      );
    });

    try {
      await downloadAndInstall(remote.apkUrl);
    } catch (e) {
      setState({ phase: 'error', message: String(e) });
    } finally {
      sub?.remove();
    }
  };

  const dismiss = () => setState({ phase: 'idle' });

  return { state, startUpdate, dismiss };
};
