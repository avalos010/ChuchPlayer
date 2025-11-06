import { useCallback } from 'react';
import { Channel, EPGProgram } from '../types';
import { usePlayerStore } from '../store/usePlayerStore';

export const useEPGManagement = () => {
  const channels = usePlayerStore((state) => state.channels);

  // Generate hourly dummy programs for each channel
  const getProgramsForChannel = useCallback((channelId: string): EPGProgram[] => {
    const channelData = channels.find(c => c.id === channelId);
    if (!channelData) return [];

    const now = new Date();
    const channelName = channelData.name || 'Unknown Channel';
    const programs: EPGProgram[] = [];

    // Generate programs for the past 12 hours and next 36 hours (48 hours total)
    for (let i = -12; i < 36; i++) {
      const hourStart = new Date(now);
      hourStart.setHours(now.getHours() + i, 0, 0, 0);
      const hourEnd = new Date(hourStart);
      hourEnd.setHours(hourStart.getHours() + 1);

      // Generate program titles based on channel name patterns and hour
      let programTitle = '';
      const hour = hourStart.getHours();

      if (channelName.toLowerCase().includes('news')) {
        const newsTitles = [
          'Morning News', 'Breaking News', 'Noon Update', 'Evening News',
          'Nightly Report', 'Late Night Update', 'Early Morning Brief'
        ];
        programTitle = newsTitles[hour % newsTitles.length];
      } else if (channelName.toLowerCase().includes('sport')) {
        const sportTitles = [
          'Live Match', 'Sports Highlights', 'Game Analysis', 'Live Coverage',
          'Sports Center', 'Match Replay', 'Sports Talk'
        ];
        programTitle = sportTitles[hour % sportTitles.length];
      } else if (channelName.toLowerCase().includes('movie')) {
        const movieTitles = [
          'Movie: Action Film', 'Movie: Drama', 'Movie: Comedy', 'Movie: Thriller',
          'Classic Cinema', 'Movie Night', 'Film Festival'
        ];
        programTitle = movieTitles[hour % movieTitles.length];
      } else {
        const genericTitles = [
          'Live Program', 'Featured Show', 'Entertainment Hour', 'Special Program',
          'Main Event', 'Live Coverage', 'Popular Series'
        ];
        programTitle = genericTitles[hour % genericTitles.length];
      }

      programs.push({
        id: `epg-${channelId}-${i}-${hourStart.getTime()}`,
        channelId,
        title: programTitle,
        description: `${programTitle} on ${channelName}`,
        start: hourStart,
        end: hourEnd,
      });
    }

    return programs;
  }, [channels]);

  // Get current program (for compatibility with existing code)
  const getCurrentProgram = useCallback((channelId: string): EPGProgram | null => {
    const programs = getProgramsForChannel(channelId);
    const now = new Date();
    return programs.find(p => p.start <= now && p.end > now) || programs[0] || null;
  }, [getProgramsForChannel]);

  return {
    getProgramsForChannel,
    getCurrentProgram,
  };
};

