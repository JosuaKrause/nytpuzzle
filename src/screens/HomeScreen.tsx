import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getCachedGames, getCompletionStatuses, SyncStatus } from '../services/puzzleStore';
import { prefetchDate } from '../services/preloader';
import { SyncBadge } from '../components/SyncBadge';

const GAMES = ['wordle', 'connections', 'strands', 'mini'] as const;
type GameName = typeof GAMES[number];

const GAME_ROUTE: Record<GameName, keyof RootStackParamList> = {
  wordle: 'Wordle',
  connections: 'Connections',
  strands: 'Strands',
  mini: 'Mini',
};

const GAME_LABEL: Record<GameName, string> = {
  wordle: 'Wordle',
  connections: 'Connections',
  strands: 'Strands',
  mini: 'Mini Crossword',
};

interface GameRow {
  cached: boolean;
  syncStatus: SyncStatus | null;
}

interface ScreenState {
  loading: boolean;
  games: Record<string, GameRow>;
  preloading: boolean;
  error: string | null;
}

interface Props {
  nytS?: string;
  nytA?: string;
  dryRun?: boolean;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function offsetDate(from: string, days: number): string {
  const d = new Date(from + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function HomeScreen({ nytS, nytA, dryRun = false }: Props) {
  const today = todayString();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [date, setDate] = useState(today);
  const [state, setState] = useState<ScreenState>({
    loading: true,
    games: {},
    preloading: false,
    error: null,
  });

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const [cached, statuses] = await Promise.all([
        getCachedGames(date),
        getCompletionStatuses(date),
      ]);
      const games: Record<string, GameRow> = {};
      for (const game of GAMES) {
        games[game] = {
          cached: cached.includes(game),
          syncStatus: statuses[game] ?? null,
        };
      }
      setState(s => ({ ...s, loading: false, games, error: null }));
    } catch {
      setState(s => ({ ...s, loading: false, error: 'Failed to load puzzle status.' }));
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const goToPrevDay = useCallback(() => {
    setDate(d => offsetDate(d, -1));
  }, []);

  const goToNextDay = useCallback(() => {
    setDate(d => offsetDate(d, 1));
  }, []);

  const preload = useCallback(async () => {
    setState(s => ({ ...s, preloading: true, error: null }));
    try {
      await prefetchDate(date, nytS, nytA);
      await load();
    } catch {
      setState(s => ({ ...s, error: 'Preload failed.' }));
    } finally {
      setState(s => ({ ...s, preloading: false }));
    }
  }, [date, nytS, nytA, load]);

  if (state.loading) {
    return (
      <View style={styles.center} testID="loading">
        <ActivityIndicator />
      </View>
    );
  }

  const atToday = date >= today;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.dateRow}>
        <Pressable onPress={goToPrevDay} testID="prev-day" style={styles.arrow}>
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <Text style={styles.heading}>{date}</Text>
        <Pressable
          onPress={goToNextDay}
          testID="next-day"
          disabled={atToday}
          style={styles.arrow}
        >
          <Text style={[styles.arrowText, atToday && styles.arrowDisabled]}>›</Text>
        </Pressable>
      </View>

      {dryRun ? (
        <View style={styles.dryRunBanner} testID="dry-run-banner">
          <Text style={styles.dryRunText}>DEV — results not saved</Text>
        </View>
      ) : null}

      {state.error ? <Text style={styles.error}>{state.error}</Text> : null}

      {GAMES.map(game => {
        const row = state.games[game];
        return (
          <Pressable
            key={game}
            style={styles.row}
            testID={`row-${game}`}
            onPress={() => navigation.navigate(GAME_ROUTE[game] as 'Wordle', { date, dryRun })}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.gameName}>{GAME_LABEL[game]}</Text>
              <Text style={[styles.cacheStatus, row?.cached ? styles.cached : styles.uncached]}>
                {row?.cached ? 'Ready offline' : 'Not cached'}
              </Text>
            </View>
            {row?.syncStatus ? <SyncBadge status={row.syncStatus} /> : null}
          </Pressable>
        );
      })}

      <Pressable
        style={[styles.button, state.preloading && styles.buttonDisabled]}
        onPress={preload}
        disabled={state.preloading}
        testID="preload-button"
      >
        <Text style={styles.buttonText}>
          {state.preloading ? 'Loading…' : 'Preload'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 20 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  heading: { fontSize: 20, fontWeight: '700' },
  arrow: { padding: 8 },
  arrowText: { fontSize: 28, fontWeight: '300', color: '#1D4ED8' },
  arrowDisabled: { color: '#D1D5DB' },
  dryRunBanner: { marginBottom: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: '#FEF3C7', alignSelf: 'flex-start' },
  dryRunText: { fontSize: 12, color: '#92400E', fontWeight: '600' },
  error: { color: '#F87171', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  rowLeft: { flex: 1 },
  gameName: { fontSize: 16, fontWeight: '600' },
  cacheStatus: { fontSize: 12, marginTop: 2 },
  cached: { color: '#34D399' },
  uncached: { color: '#9CA3AF' },
  button: {
    marginTop: 24,
    backgroundColor: '#1D4ED8',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#93C5FD' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
