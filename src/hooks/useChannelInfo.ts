import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';

export const useChannelInfo = () => {
  const channel = usePlayerStore((state) => state.channel);
  const [showChannelInfoCard, setShowChannelInfoCard] = useState(false);
  const previousChannelIdRef = useRef<string | null>(null);

  // Show channel info card when channel changes (but not on initial load)
  useEffect(() => {
    if (!channel) return;

    // Skip showing on initial load
    if (previousChannelIdRef.current === null) {
      previousChannelIdRef.current = channel.id;
      return;
    }

    // Only show if channel actually changed
    if (previousChannelIdRef.current !== channel.id) {
      previousChannelIdRef.current = channel.id;
      setShowChannelInfoCard(true);
    }
  }, [channel?.id]);

  return {
    showChannelInfoCard,
    setShowChannelInfoCard,
  };
};


