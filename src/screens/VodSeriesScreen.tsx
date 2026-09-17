import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import FocusableItem from '../components/FocusableItem';
import { RootStackParamList, VodEpisode } from '../types';
import { Theme } from '../theme/themes';
import { useThemeStore } from '../store/useThemeStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { fetchXtreamSeriesEpisodes } from '../utils/xtreamParser';

const GRID_GAP = 22;
const PAGE_PADDING = 42;

interface VodSeriesScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'VodSeries'>;
  route: RouteProp<RootStackParamList, 'VodSeries'>;
}

interface EpisodeCardProps {
  item: VodEpisode;
  width: number;
  theme: Theme;
  onPress: (item: VodEpisode) => void;
}

const EpisodeCard = memo<EpisodeCardProps>(({ item, width, theme, onPress }) => (
  <FocusableItem
    onPress={() => onPress(item)}
    style={[styles.card, { width }]}
    focusedStyle={{ borderColor: theme.accent, borderWidth: 3, transform: [{ scale: 1.04 }] }}
  >
    <View style={[styles.poster, { height: width * 0.58, backgroundColor: theme.card }]}>
      {item.poster ? (
        <Image source={{ uri: item.poster }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
      ) : (
        <MCI name="play-circle-outline" size={46} color={theme.textMuted} />
      )}
    </View>
    <Text style={[styles.episodeNumber, { color: theme.accent }]}>S{item.season.toString().padStart(2, '0')} E{item.episode.toString().padStart(2, '0')}</Text>
    <Text style={[styles.episodeTitle, { color: theme.text }]} numberOfLines={2}>{item.name}</Text>
  </FocusableItem>
));

EpisodeCard.displayName = 'EpisodeCard';

const VodSeriesScreen: React.FC<VodSeriesScreenProps> = ({ navigation, route }) => {
  const theme = useThemeStore((state) => state.theme);
  const playlist = usePlayerStore((state) => state.playlist);
  const { width } = useWindowDimensions();
  const series = route.params.series;
  const columns = Math.max(4, Math.min(6, Math.floor((width - PAGE_PADDING * 2) / 230)));
  const cardWidth = (width - PAGE_PADDING * 2 - GRID_GAP * (columns - 1)) / columns;
  const [episodes, setEpisodes] = useState<VodEpisode[]>([]);
  const [season, setSeason] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!playlist?.xtreamCredentials) {
      setLoading(false);
      setError('TV shows are available for Xtream playlists only.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchXtreamSeriesEpisodes(playlist.xtreamCredentials, series.id)
      .then((loaded) => {
        if (cancelled) return;
        setEpisodes(loaded);
        setSeason(loaded.length ? Math.min(...loaded.map((item) => item.season)) : null);
        if (!loaded.length) setError('The provider returned no episodes for this show.');
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [playlist?.id, playlist?.xtreamCredentials, reloadToken, series.id]);

  const seasons = useMemo(() => Array.from(new Set(episodes.map((item) => item.season))).sort((a, b) => a - b), [episodes]);
  const visibleEpisodes = useMemo(() => episodes.filter((item) => item.season === season), [episodes, season]);
  const playEpisode = useCallback((item: VodEpisode) => navigation.navigate('VodPlayer', { item }), [navigation]);
  const renderEpisode = useCallback(({ item }: { item: VodEpisode }) => (
    <EpisodeCard item={item} width={cardWidth} theme={theme} onPress={playEpisode} />
  ), [cardWidth, playEpisode, theme]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: theme.accent }]}>{series.group || 'TV Show'}</Text>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{series.name}</Text>
          {series.plot ? <Text style={[styles.plot, { color: theme.textSub }]} numberOfLines={2}>{series.plot}</Text> : null}
        </View>
        <FocusableItem
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: theme.card, borderColor: theme.border }]}
          focusedStyle={{ borderColor: theme.accent, borderWidth: 2, transform: [] }}
        >
          <MCI name="arrow-left" size={22} color={theme.text} />
          <Text style={[styles.backText, { color: theme.text }]}>TV Shows</Text>
        </FocusableItem>
      </View>

      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Loading episodes</Text>
        </View>
      ) : error ? (
        <View style={styles.empty}>
          <MCI name="television-off" size={68} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>{error}</Text>
          <FocusableItem
            onPress={() => setReloadToken((value) => value + 1)}
            hasTVPreferredFocus
            style={[styles.retryButton, { backgroundColor: theme.card, borderColor: theme.border }]}
            focusedStyle={{ borderColor: theme.accent, borderWidth: 3, transform: [] }}
          >
            <MCI name="refresh" size={22} color={theme.text} />
            <Text style={[styles.backText, { color: theme.text }]}>Retry</Text>
          </FocusableItem>
        </View>
      ) : (
        <>
          <FlatList
            horizontal
            data={seasons}
            keyExtractor={(item) => String(item)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.seasons}
            renderItem={({ item, index }) => {
              const selected = item === season;
              return (
                <FocusableItem
                  onPress={() => setSeason(item)}
                  hasTVPreferredFocus={index === 0}
                  style={[styles.season, { backgroundColor: selected ? theme.accent : theme.card, borderColor: selected ? theme.accent : theme.border }]}
                  focusedStyle={{ borderColor: theme.focused, borderWidth: 2, transform: [] }}
                >
                  <Text style={[styles.seasonText, { color: selected ? theme.accentText : theme.text }]}>Season {item}</Text>
                </FocusableItem>
              );
            }}
          />
          <FlatList
            key={columns}
            data={visibleEpisodes}
            numColumns={columns}
            keyExtractor={(item) => item.id}
            renderItem={renderEpisode}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={{ gap: GRID_GAP }}
            showsVerticalScrollIndicator={false}
            initialNumToRender={columns * 2}
            windowSize={5}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 56 },
  header: { minHeight: 126, paddingHorizontal: PAGE_PADDING, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 24 },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 13, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontSize: 38, fontWeight: '900', marginTop: 2 },
  plot: { fontSize: 15, marginTop: 4, maxWidth: 820 },
  backButton: { minWidth: 136, height: 52, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  backText: { fontSize: 15, fontWeight: '800' },
  seasons: { paddingHorizontal: PAGE_PADDING, gap: 12, paddingTop: 12, paddingBottom: 20 },
  season: { height: 46, paddingHorizontal: 20, borderRadius: 23, borderWidth: 1, justifyContent: 'center' },
  seasonText: { fontSize: 15, fontWeight: '800' },
  grid: { paddingHorizontal: PAGE_PADDING, paddingBottom: 48, gap: 26 },
  card: { borderWidth: 2, borderColor: 'transparent', borderRadius: 13, overflow: 'hidden', paddingBottom: 8 },
  poster: { width: '100%', borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  episodeNumber: { fontSize: 12, fontWeight: '900', marginTop: 9, paddingHorizontal: 4, letterSpacing: 0.8 },
  episodeTitle: { fontSize: 15, fontWeight: '800', lineHeight: 19, marginTop: 3, paddingHorizontal: 4, minHeight: 38 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 120, paddingHorizontal: 36 },
  emptyTitle: { fontSize: 24, fontWeight: '900', marginTop: 20, textAlign: 'center' },
  retryButton: { height: 52, minWidth: 132, borderRadius: 12, borderWidth: 1, marginTop: 24, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
});

export default VodSeriesScreen;
