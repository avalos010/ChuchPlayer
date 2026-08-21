import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FocusableItem from '../components/FocusableItem';
import { RootStackParamList, VodItem } from '../types';
import { Theme } from '../theme/themes';
import { useThemeStore } from '../store/useThemeStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { fetchXtreamVodCatalog } from '../utils/xtreamParser';
import { savePlaylist } from '../utils/storage';

const ALL_MOVIES = 'All Movies';
const GRID_GAP = 22;
const PAGE_PADDING = 42;
const EMPTY_VOD_ITEMS: VodItem[] = [];

interface VodCatalogScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'VodCatalog'>;
}

interface VodCardProps {
  item: VodItem;
  width: number;
  theme: Theme;
  onPress: (item: VodItem) => void;
}

const VodCard = memo<VodCardProps>(({ item, width, theme, onPress }) => {
  const year = item.releaseDate?.match(/\d{4}/)?.[0];
  return (
    <FocusableItem
      onPress={() => onPress(item)}
      style={[styles.card, { width }]}
      focusedStyle={{ borderColor: theme.accent, borderWidth: 3, transform: [{ scale: 1.04 }] }}
    >
      <View style={[styles.poster, { height: width * 1.42, backgroundColor: theme.card }]}>
        {item.poster ? (
          <Image source={{ uri: item.poster }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
        ) : (
          <MCI name="movie-open-outline" size={52} color={theme.textMuted} />
        )}
      </View>
      <Text style={[styles.movieTitle, { color: theme.text }]} numberOfLines={2}>{item.name}</Text>
      <Text style={[styles.movieMeta, { color: theme.textSub }]} numberOfLines={1}>
        {[year, item.rating ? `★ ${item.rating}` : null].filter(Boolean).join('  ·  ') || item.group || 'Movie'}
      </Text>
    </FocusableItem>
  );
});

VodCard.displayName = 'VodCard';

const VodCatalogScreen: React.FC<VodCatalogScreenProps> = ({ navigation }) => {
  const theme = useThemeStore((state) => state.theme);
  const playlist = usePlayerStore((state) => state.playlist);
  const { width } = useWindowDimensions();
  const items = playlist?.vodItems ?? EMPTY_VOD_ITEMS;
  const columns = Math.max(5, Math.min(7, Math.floor((width - PAGE_PADDING * 2) / 170)));
  const cardWidth = (width - PAGE_PADDING * 2 - GRID_GAP * (columns - 1)) / columns;
  const [category, setCategory] = useState(ALL_MOVIES);
  const [reloadToken, setReloadToken] = useState(0);
  const [loading, setLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    if (items.length || playlist?.sourceType !== 'xtream' || !playlist.xtreamCredentials) return;
    let cancelled = false;
    setLoading(true);
    setCatalogError(null);

    fetchXtreamVodCatalog(playlist.xtreamCredentials)
      .then(async (vodItems) => {
        if (cancelled) return;
        if (!vodItems.length) {
          setCatalogError('The provider returned no VOD movies for this account.');
          return;
        }
        const updated = { ...playlist, vodItems, updatedAt: new Date() };
        usePlayerStore.getState().setPlaylist(updated);
        await savePlaylist(updated);
      })
      .catch((error) => {
        if (!cancelled) setCatalogError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [items.length, playlist?.id, playlist?.sourceType, reloadToken]);

  const categories = useMemo(() => {
    const groups = new Set(items.map((item) => item.group || 'Uncategorized'));
    return [ALL_MOVIES, ...Array.from(groups).sort((a, b) => a.localeCompare(b))];
  }, [items]);

  const filteredItems = useMemo(
    () => category === ALL_MOVIES ? items : items.filter((item) => (item.group || 'Uncategorized') === category),
    [category, items],
  );

  const playMovie = useCallback((item: VodItem) => {
    navigation.navigate('VodPlayer', { item });
  }, [navigation]);

  const openLiveTv = useCallback(() => {
    if (playlist?.channels.length) navigation.replace('Player', {});
    else navigation.navigate('Settings');
  }, [navigation, playlist?.channels.length]);

  const renderMovie = useCallback(({ item }: { item: VodItem }) => (
    <VodCard item={item} width={cardWidth} theme={theme} onPress={playMovie} />
  ), [cardWidth, playMovie, theme]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: theme.accent }]}>{playlist?.name ?? 'Playlist'}</Text>
          <Text style={[styles.title, { color: theme.text }]}>Movies</Text>
          <Text style={[styles.subtitle, { color: theme.textSub }]}>{filteredItems.length} titles</Text>
        </View>
        <View style={styles.headerActions}>
          <FocusableItem
            onPress={openLiveTv}
            style={[styles.headerButton, { backgroundColor: theme.card, borderColor: theme.border }]}
            focusedStyle={{ borderColor: theme.accent, borderWidth: 2, transform: [] }}
          >
            <MCI name="television-classic" size={22} color={theme.text} />
            <Text style={[styles.headerButtonText, { color: theme.text }]}>Live TV</Text>
          </FocusableItem>
          <FocusableItem
            onPress={() => navigation.navigate('Settings')}
            style={[styles.headerButton, { backgroundColor: theme.card, borderColor: theme.border }]}
            focusedStyle={{ borderColor: theme.accent, borderWidth: 2, transform: [] }}
          >
            <MCI name="cog-outline" size={22} color={theme.text} />
            <Text style={[styles.headerButtonText, { color: theme.text }]}>Settings</Text>
          </FocusableItem>
        </View>
      </View>

      {items.length ? (
        <>
          <FlatList
            horizontal
            data={categories}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categories}
            style={styles.categoryList}
            renderItem={({ item, index }) => {
              const selected = item === category;
              return (
                <FocusableItem
                  onPress={() => setCategory(item)}
                  hasTVPreferredFocus={index === 0}
                  style={[
                    styles.category,
                    { backgroundColor: selected ? theme.accent : theme.card, borderColor: selected ? theme.accent : theme.border },
                  ]}
                  focusedStyle={{ borderColor: theme.focused, borderWidth: 2, transform: [] }}
                >
                  <Text style={[styles.categoryText, { color: selected ? theme.accentText : theme.text }]}>{item}</Text>
                </FocusableItem>
              );
            }}
          />
          <FlatList
            key={columns}
            data={filteredItems}
            numColumns={columns}
            keyExtractor={(item) => item.id}
            renderItem={renderMovie}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={{ gap: GRID_GAP }}
            showsVerticalScrollIndicator={false}
            initialNumToRender={columns * 2}
            windowSize={5}
          />
        </>
      ) : loading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Loading movies</Text>
          <Text style={[styles.emptyText, { color: theme.textSub }]}>Downloading the VOD catalog from your provider…</Text>
        </View>
      ) : (
        <View style={styles.empty}>
          <MCI name="movie-off-outline" size={72} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No movies loaded</Text>
          <Text style={[styles.emptyText, { color: theme.textSub }]}>{catalogError ?? 'This playlist does not contain recognizable movie streams.'}</Text>
          {playlist?.sourceType === 'xtream' ? (
            <FocusableItem
              onPress={() => setReloadToken((token) => token + 1)}
              hasTVPreferredFocus
              style={[styles.retryButton, { backgroundColor: theme.card, borderColor: theme.border }]}
              focusedStyle={{ borderColor: theme.accent, borderWidth: 3, transform: [] }}
            >
              <MCI name="refresh" size={22} color={theme.text} />
              <Text style={[styles.headerButtonText, { color: theme.text }]}>Retry</Text>
            </FocusableItem>
          ) : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 28 },
  header: { minHeight: 112, paddingHorizontal: PAGE_PADDING, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 13, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontSize: 38, fontWeight: '900', marginTop: 2 },
  subtitle: { fontSize: 15, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 14 },
  headerButton: { minWidth: 128, height: 52, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  headerButtonText: { fontSize: 15, fontWeight: '800' },
  categoryList: { flexGrow: 0, marginTop: 12, marginBottom: 20 },
  categories: { paddingHorizontal: PAGE_PADDING, gap: 12 },
  category: { height: 46, paddingHorizontal: 20, borderRadius: 23, borderWidth: 1, justifyContent: 'center' },
  categoryText: { fontSize: 15, fontWeight: '800' },
  grid: { paddingHorizontal: PAGE_PADDING, paddingBottom: 48, gap: 26 },
  card: { borderWidth: 2, borderColor: 'transparent', borderRadius: 13, overflow: 'hidden', paddingBottom: 8 },
  poster: { width: '100%', borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  movieTitle: { fontSize: 15, fontWeight: '800', lineHeight: 19, marginTop: 10, paddingHorizontal: 4, minHeight: 38 },
  movieMeta: { fontSize: 12, marginTop: 3, paddingHorizontal: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 120 },
  emptyTitle: { fontSize: 28, fontWeight: '900', marginTop: 20 },
  emptyText: { fontSize: 16, marginTop: 8, maxWidth: 520, textAlign: 'center' },
  retryButton: { height: 52, minWidth: 132, borderRadius: 12, borderWidth: 1, marginTop: 24, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
});

export default VodCatalogScreen;
