import { useEffect } from 'react';
import { Channel } from '../types';

interface UseWebPlayerKeyboardArgs {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  filteredChannels: Channel[];
  highlightedChannelId: string | null;
  setHighlightedChannelId: (channelId: string | null) => void;
  groups: string[];
  selectedGroup: string;
  setSelectedGroup: (group: string) => void;
  guideOpen: boolean;
  setGuideOpen: (open: boolean) => void;
  handleChannelSelect: (channel: Channel) => Promise<void>;
  handleTogglePlayback: () => Promise<void>;
  handleSettings: () => void;
  switchRelativeChannel: (direction: 'prev' | 'next') => Promise<void>;
  onUserActivity?: () => void;
}

export const useWebPlayerKeyboard = ({
  sidebarOpen,
  setSidebarOpen,
  filteredChannels,
  highlightedChannelId,
  setHighlightedChannelId,
  groups,
  selectedGroup,
  setSelectedGroup,
  guideOpen,
  setGuideOpen,
  handleChannelSelect,
  handleTogglePlayback,
  handleSettings,
  switchRelativeChannel,
  onUserActivity,
}: UseWebPlayerKeyboardArgs) => {
  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      onUserActivity?.();

      if (sidebarOpen) {
        const currentIndex = Math.max(
          0,
          filteredChannels.findIndex((channel) => channel.id === highlightedChannelId),
        );

        if (event.key === 'ArrowUp') {
          const next = filteredChannels[Math.max(0, currentIndex - 1)];
          if (next) {
            setHighlightedChannelId(next.id);
            await handleChannelSelect(next);
          }
          event.preventDefault();
          return;
        }

        if (event.key === 'ArrowDown') {
          const next = filteredChannels[Math.min(filteredChannels.length - 1, currentIndex + 1)];
          if (next) {
            setHighlightedChannelId(next.id);
            await handleChannelSelect(next);
          }
          event.preventDefault();
          return;
        }

        if (event.key === 'Enter') {
          const selected = filteredChannels[currentIndex];
          if (selected) {
            await handleChannelSelect(selected);
            setSidebarOpen(false);
          }
          event.preventDefault();
          return;
        }

        if (event.key === 'Escape') {
          setGuideOpen(true);
          setSidebarOpen(false);
          event.preventDefault();
          return;
        }

        if (event.key === 'ArrowRight') {
          setSidebarOpen(false);
          event.preventDefault();
          return;
        }
      }

      if (event.key === 'Escape') {
        if (guideOpen) {
          setGuideOpen(false);
        } else {
          setSidebarOpen(false);
          setGuideOpen(true);
        }
        event.preventDefault();
        return;
      }

      if (event.key === 'ArrowLeft') {
        setSidebarOpen(true);
        event.preventDefault();
        return;
      }

      if (event.key === 'ArrowUp') {
        await switchRelativeChannel('prev');
        event.preventDefault();
        return;
      }

      if (event.key === 'ArrowDown') {
        await switchRelativeChannel('next');
        event.preventDefault();
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        await handleTogglePlayback();
        event.preventDefault();
        return;
      }

      if (event.key === 'g' || event.key === 'G') {
        const currentGroupIndex = Math.max(0, groups.indexOf(selectedGroup));
        const nextGroup = groups[(currentGroupIndex + 1) % groups.length];
        setSelectedGroup(nextGroup);
        setSidebarOpen(true);
        event.preventDefault();
        return;
      }

      if (event.key === 's' || event.key === 'S') {
        handleSettings();
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    filteredChannels,
    groups,
    guideOpen,
    handleChannelSelect,
    handleSettings,
    handleTogglePlayback,
    highlightedChannelId,
    onUserActivity,
    selectedGroup,
    setHighlightedChannelId,
    setGuideOpen,
    setSelectedGroup,
    setSidebarOpen,
    sidebarOpen,
    switchRelativeChannel,
  ]);
};
