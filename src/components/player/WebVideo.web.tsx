import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Hls from 'hls.js';

interface WebVideoProps {
  uri: string;
  isPlaying: boolean;
  onError?: () => void;
  onLoad?: () => void;
}

const isHlsUri = (uri: string) =>
  uri.includes('.m3u8') || uri.includes('m3u8') || uri.includes('/hls/');

const WebVideo: React.FC<WebVideoProps> = ({ uri, isPlaying, onError, onLoad }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef   = useRef<Hls | null>(null);

  // Attach source whenever URI changes
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !uri) return;

    // Tear down any previous HLS instance
    hlsRef.current?.destroy();
    hlsRef.current = null;

    if (isHlsUri(uri) && Hls.isSupported()) {
      // Chrome/Firefox/Edge — use HLS.js
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
      });
      hls.loadSource(uri);
      hls.attachMedia(v);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        onLoad?.();
        if (isPlaying) v.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) onError?.();
      });
      hlsRef.current = hls;
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari — native HLS
      v.src = uri;
      v.load();
      onLoad?.();
      if (isPlaying) v.play().catch(() => {});
    } else {
      // Plain HTTP stream or other format
      v.src = uri;
      v.load();
      onLoad?.();
      if (isPlaying) v.play().catch(() => {});
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  // Sync play/pause without re-mounting
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [isPlaying]);

  return (
    <View style={s.container}>
      {/* @ts-ignore – raw HTML element, valid in React Native Web */}
      <video
        ref={videoRef}
        style={videoStyle}
        controls
        playsInline
        onError={onError}
      />
    </View>
  );
};

export default WebVideo;

// Inline style object — React Native Web passes this as a CSS style object
const videoStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'contain' as const,
  backgroundColor: '#000',
  display: 'block',
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
});
