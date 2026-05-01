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
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HomeScreen({ nytS, nytA }: Props) {
  const today = todayString();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [state, setState] = useState<ScreenState>({
    loading: true,
    games: {},
    preloading: false,
    error: null,
  });

  const load = useCallback(async () => {
    try {
      const [cached, statuses] = await Promise.all([
        getCachedGames(today),
        getCompletionStatuses(today),
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
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  const preload = useCallback(async () => {
    setState(s => ({ ...s, preloading: true, error: null }));
    try {
      await prefetchDate(today, nytS, nytA);
      await load();
    } catch {
      setState(s => ({ ...s, error: 'Preload failed.' }));
    } finally {
      setState(s => ({ ...s, preloading: false }));
    }
  }, [today, nytS, nytA, load]);

  if (state.loading) {
    return (
      <View style={styles.center} testID="loading">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>NYT Puzzles — {today}</Text>

      {state.error ? <Text style={styles.error}>{state.error}</Text> : null}

      {GAMES.map(game => {
        const row = state.games[game];
        return (
          <Pressable
            key={game}
            style={styles.row}
            testID={`row-${game}`}
            onPress={() => navigation.navigate(GAME_ROUTE[game] as 'Wordle', { date: today })}
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
          {state.preloading ? 'Loading…' : 'Preload Today'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 20 },
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
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
