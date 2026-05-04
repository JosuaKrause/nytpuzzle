import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { WordlePuzzle } from '../services/nytClient';
import { getPuzzle, saveCompletion } from '../services/puzzleStore';
import {
  TileState,
  buildKeyboardColors,
  computeLockedPositions,
  computeRowColors,
  validateHardMode,
} from '../services/wordle';
import { Keyboard } from '../components/wordle/Keyboard';

type Props = NativeStackScreenProps<RootStackParamList, 'Wordle'>;
type GameStatus = 'loading' | 'error' | 'in_progress' | 'win' | 'fail';

interface State {
  puzzle: WordlePuzzle | null;
  boardState: string[];
  tileColors: TileState[][];
  currentTiles: string[];
  locked: (string | null)[];
  currentRow: number;
  status: GameStatus;
  keyColors: Record<string, TileState>;
  message: string | null;
  hardMode: boolean;
}

const EMPTY_BOARD: string[] = Array(6).fill('');
const EMPTY_TILES: string[] = Array(5).fill('');
const EMPTY_LOCKED: (string | null)[] = Array(5).fill(null);

const TILE_BG: Record<TileState, string> = {
  correct: '#538D4E',
  present: '#B59F3B',
  absent:  '#3A3A3C',
  pending: '#121213',
  empty:   '#121213',
};
const TILE_BORDER: Record<TileState, string> = {
  correct: '#538D4E',
  present: '#B59F3B',
  absent:  '#3A3A3C',
  pending: '#565758',
  empty:   '#3A3A3C',
};

function initTilesFromLocked(locked: (string | null)[]): string[] {
  return locked.map(l => l ?? '');
}

const SHAKE = [
  { toValue: -8, duration: 60 },
  { toValue: 8,  duration: 60 },
  { toValue: -8, duration: 60 },
  { toValue: 8,  duration: 60 },
  { toValue: 0,  duration: 60 },
] as const;

export function WordleScreen({ route, navigation }: Props) {
  const { date, dryRun = false } = route.params;

  const [state, setState] = useState<State>({
    puzzle: null,
    boardState: [...EMPTY_BOARD],
    tileColors: [],
    currentTiles: [...EMPTY_TILES],
    locked: [...EMPTY_LOCKED],
    currentRow: 0,
    status: 'loading',
    keyColors: {},
    message: null,
    hardMode: true,
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  // Animation refs ------------------------------------------------------------
  // scaleY for each column during row flip (1 = full, 0 = squashed)
  const flipAnims = useRef(Array.from({ length: 5 }, () => new Animated.Value(1))).current;
  // scale for each locked tile's prefill pop (0 → 1)
  const prefillAnims = useRef(Array.from({ length: 5 }, () => new Animated.Value(1))).current;
  // translateX for the shaking row
  const rowShakeAnim = useRef(new Animated.Value(0)).current;

  const [flippingRow, setFlippingRow] = useState<number | null>(null);
  const [revealedCols, setRevealedCols] = useState<boolean[]>([]);
  const [shakingRow, setShakingRow] = useState<number | null>(null);

  // Track previous locked to detect new prefill positions
  const prevLockedRef = useRef<(string | null)[]>([...EMPTY_LOCKED]);

  // ---------------------------------------------------------------------------

  useEffect(() => {
    getPuzzle<WordlePuzzle>('wordle', date).then(puzzle => {
      if (!puzzle) {
        setState(s => ({ ...s, status: 'error' }));
      } else {
        setState(s => ({ ...s, puzzle, status: 'in_progress' }));
      }
    });
  }, [date]);

  // Animate prefill pop whenever new locked positions appear
  useEffect(() => {
    const prev = prevLockedRef.current;
    prevLockedRef.current = [...state.locked];
    state.locked.forEach((l, col) => {
      if (l !== null && prev[col] === null) {
        prefillAnims[col].setValue(0);
        Animated.spring(prefillAnims[col], {
          toValue: 1,
          useNativeDriver: true,
        }).start();
      }
    });
  }, [state.locked, prefillAnims]);

  const shakeRow = useCallback((row: number) => {
    setShakingRow(row);
    rowShakeAnim.setValue(0);
    Animated.sequence(
      SHAKE.map(({ toValue, duration }) =>
        Animated.timing(rowShakeAnim, { toValue, duration, useNativeDriver: true }),
      ),
    ).start(() => setShakingRow(null));
  }, [rowShakeAnim]);

  const startFlip = useCallback((row: number) => {
    flipAnims.forEach(a => a.setValue(1));
    setFlippingRow(row);
    setRevealedCols([false, false, false, false, false]);

    let done = 0;
    for (let col = 0; col < 5; col++) {
      Animated.sequence([
        Animated.delay(col * 100),
        Animated.timing(flipAnims[col], { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start(() => {
        setRevealedCols(prev => prev.map((v, i) => (i === col ? true : v)));
        Animated.timing(flipAnims[col], { toValue: 1, duration: 150, useNativeDriver: true })
          .start(() => {
            done += 1;
            if (done === 5) {
              setFlippingRow(null);
              setRevealedCols([]);
            }
          });
      });
    }
  }, [flipAnims]);

  const handleKey = useCallback((key: string) => {
    if (key === '⌫') {
      setState(s => {
        for (let i = 4; i >= 0; i--) {
          if (s.locked[i] === null && s.currentTiles[i] !== '') {
            const tiles = [...s.currentTiles];
            tiles[i] = '';
            return { ...s, currentTiles: tiles, message: null };
          }
        }
        return { ...s, message: null };
      });
      return;
    }

    if (key !== 'ENTER') {
      setState(s => {
        for (let i = 0; i < 5; i++) {
          if (s.locked[i] === null && s.currentTiles[i] === '') {
            const tiles = [...s.currentTiles];
            tiles[i] = key;
            return { ...s, currentTiles: tiles, message: null };
          }
        }
        return s;
      });
      return;
    }

    // ENTER — read fresh state via ref
    const s = stateRef.current;
    const allFilled = s.currentTiles.every(t => t !== '');
    if (!allFilled) {
      setState(prev => ({ ...prev, message: 'Not enough letters' }));
      shakeRow(s.currentRow);
      return;
    }

    const guess = s.currentTiles.join('');

    if (s.hardMode) {
      const err = validateHardMode(guess, s.boardState, s.tileColors);
      if (err) {
        setState(prev => ({ ...prev, message: err }));
        shakeRow(s.currentRow);
        return;
      }
    }

    const solution = s.puzzle!.solution;
    const colors = computeRowColors(guess, solution);
    const newBoard = [...s.boardState];
    newBoard[s.currentRow] = guess;
    const newColors = [...s.tileColors, colors];
    const newKeyColors = buildKeyboardColors(newBoard, solution);
    const won = colors.every(c => c === 'correct');
    const nextRow = s.currentRow + 1;
    const newStatus: GameStatus = won ? 'win' : nextRow >= 6 ? 'fail' : 'in_progress';
    const newLocked = computeLockedPositions(newBoard, newColors);
    const newTiles = initTilesFromLocked(newLocked);

    if (newStatus !== 'in_progress' && !dryRun) {
      saveCompletion('wordle', date, String(s.puzzle!.id), {
        boardState: newBoard,
        currentRowIndex: nextRow,
        hardMode: s.hardMode,
        isPlayingArchive: false,
        status: won ? 'WIN' : 'FAIL',
      });
    }

    setState({
      ...s,
      boardState: newBoard,
      tileColors: newColors,
      currentTiles: newTiles,
      locked: newLocked,
      currentRow: nextRow,
      status: newStatus,
      keyColors: newKeyColors,
      message: won ? '🎉' : newStatus === 'fail' ? solution.toUpperCase() : null,
    });

    startFlip(s.currentRow);
  }, [date, dryRun, shakeRow, startFlip]);

  const toggleHardMode = useCallback(() => {
    setState(s => ({ ...s, hardMode: !s.hardMode }));
  }, []);

  if (state.status === 'loading') {
    return (
      <SafeAreaView style={styles.center} testID="loading">
        <Text style={styles.msg}>Loading…</Text>
      </SafeAreaView>
    );
  }

  if (state.status === 'error') {
    return (
      <SafeAreaView style={styles.center} testID="error">
        <Text style={styles.msg}>Puzzle not cached. Go back and preload first.</Text>
        <Pressable onPress={() => navigation.goBack()} testID="go-back">
          <Text style={styles.link}>← Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const gameOver = state.status === 'win' || state.status === 'fail';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Wordle — {date}</Text>
        <View style={styles.headerRight}>
          {dryRun ? <Text style={styles.dryRunLabel}>DRY RUN</Text> : null}
          <Pressable
            onPress={toggleHardMode}
            testID="hard-mode-toggle"
            disabled={state.currentRow > 0}
          >
            <Text style={[styles.hardLabel, state.hardMode && styles.hardOn]}>
              {state.hardMode ? 'Hard ✓' : 'Hard'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.boardContainer}>
        {state.message ? (
          <View style={styles.bannerOverlay} testID="message" pointerEvents="none">
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{state.message}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.board} testID="board">
          {Array.from({ length: 6 }, (_, row) => {
            const submitted = row < state.currentRow;
            const isCurrent = row === state.currentRow;
            const isFlipping = flippingRow === row;

            const tiles = submitted
              ? state.boardState[row].toUpperCase().split('')
              : isCurrent
              ? state.currentTiles
              : Array(5).fill('');

            const shakeTransform =
              row === shakingRow ? [{ translateX: rowShakeAnim }] : undefined;

            return (
              <Animated.View
                key={row}
                style={[styles.boardRow, shakeTransform && { transform: shakeTransform }]}
                testID={`board-row-${row}`}
              >
                {Array.from({ length: 5 }, (_, col) => {
                  const letter = tiles[col];
                  const isLocked = isCurrent && state.locked[col] !== null;
                  const isRevealed = isFlipping && revealedCols[col];

                  const tileState: TileState =
                    isFlipping && !isRevealed
                      ? 'pending'
                      : submitted
                      ? state.tileColors[row][col]
                      : letter
                      ? isLocked ? 'correct' : 'pending'
                      : 'empty';

                  const tileTransform =
                    isFlipping
                      ? [{ scaleY: flipAnims[col] }]
                      : isCurrent && isLocked
                      ? [{ scale: prefillAnims[col] }]
                      : undefined;

                  return (
                    <Animated.View
                      key={col}
                      style={[
                        styles.tile,
                        { backgroundColor: TILE_BG[tileState], borderColor: TILE_BORDER[tileState] },
                        tileTransform && { transform: tileTransform },
                      ]}
                      testID={`tile-${row}-${col}`}
                    >
                      <Text style={styles.tileLetter}>{letter.toUpperCase()}</Text>
                    </Animated.View>
                  );
                })}
              </Animated.View>
            );
          })}
        </View>
      </View>

      <Keyboard keyColors={state.keyColors} onKey={handleKey} disabled={gameOver} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#121213', paddingHorizontal: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#121213' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  hardLabel: { color: '#818384', fontSize: 13 },
  hardOn: { color: '#538D4E' },
  dryRunLabel: { color: '#FBBF24', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  boardContainer: { flex: 1 },
  bannerOverlay: { position: 'absolute', top: 8, left: 0, right: 0, zIndex: 10, alignItems: 'center' },
  banner: { backgroundColor: '#fff', borderRadius: 4, paddingHorizontal: 12, paddingVertical: 6 },
  bannerText: { color: '#121213', fontWeight: '700' },
  board: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  boardRow: { flexDirection: 'row', gap: 5 },
  tile: { width: 60, height: 60, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tileLetter: { color: '#fff', fontSize: 28, fontWeight: '700' },
  msg: { color: '#fff', fontSize: 16 },
  link: { color: '#538D4E', marginTop: 12, fontSize: 16 },
});
