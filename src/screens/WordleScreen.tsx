import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  // currentTiles: length-5 array; locked positions are pre-filled and cannot be cleared
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
  absent: '#3A3A3C',
  pending: '#121213',
  empty: '#121213',
};
const TILE_BORDER: Record<TileState, string> = {
  correct: '#538D4E',
  present: '#B59F3B',
  absent: '#3A3A3C',
  pending: '#565758',
  empty: '#3A3A3C',
};

function initTilesFromLocked(locked: (string | null)[]): string[] {
  return locked.map(l => l ?? '');
}

export function WordleScreen({ route, navigation }: Props) {
  const { date } = route.params;

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

  useEffect(() => {
    getPuzzle<WordlePuzzle>('wordle', date).then(puzzle => {
      if (!puzzle) {
        setState(s => ({ ...s, status: 'error' }));
      } else {
        setState(s => ({ ...s, puzzle, status: 'in_progress' }));
      }
    });
  }, [date]);

  const handleKey = useCallback((key: string) => {
    setState(s => {
      if (key === '⌫') {
        // Remove the rightmost non-locked, non-empty tile
        for (let i = 4; i >= 0; i--) {
          if (s.locked[i] === null && s.currentTiles[i] !== '') {
            const tiles = [...s.currentTiles];
            tiles[i] = '';
            return { ...s, currentTiles: tiles, message: null };
          }
        }
        return { ...s, message: null };
      }

      if (key === 'ENTER') {
        const allFilled = s.currentTiles.every(t => t !== '');
        if (!allFilled) {
          return { ...s, message: 'Not enough letters' };
        }

        const guess = s.currentTiles.join('');

        if (s.hardMode) {
          const err = validateHardMode(guess, s.boardState, s.tileColors);
          if (err) return { ...s, message: err };
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

        // Pre-fill the next row with accumulated greens
        const newLocked = computeLockedPositions(newBoard, newColors);
        const newTiles = initTilesFromLocked(newLocked);

        if (newStatus !== 'in_progress') {
          const gameData = {
            boardState: newBoard,
            currentRowIndex: nextRow,
            hardMode: s.hardMode,
            isPlayingArchive: false,
            status: won ? 'WIN' : 'FAIL',
          };
          saveCompletion('wordle', date, String(s.puzzle!.id), gameData);
        }

        return {
          ...s,
          boardState: newBoard,
          tileColors: newColors,
          currentTiles: newTiles,
          locked: newLocked,
          currentRow: nextRow,
          status: newStatus,
          keyColors: newKeyColors,
          message: won ? '🎉' : newStatus === 'fail' ? solution.toUpperCase() : null,
        };
      }

      // Letter key: fill the next free (non-locked, empty) slot
      for (let i = 0; i < 5; i++) {
        if (s.locked[i] === null && s.currentTiles[i] === '') {
          const tiles = [...s.currentTiles];
          tiles[i] = key;
          return { ...s, currentTiles: tiles, message: null };
        }
      }
      return s; // all slots full, ignore
    });
  }, [date]);

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

      {state.message ? (
        <View style={styles.banner} testID="message">
          <Text style={styles.bannerText}>{state.message}</Text>
        </View>
      ) : null}

      <View style={styles.board} testID="board">
        {Array.from({ length: 6 }, (_, row) => {
          const submitted = row < state.currentRow;
          const isCurrent = row === state.currentRow;
          const tiles = submitted
            ? state.boardState[row].toUpperCase().split('')
            : isCurrent
            ? state.currentTiles
            : Array(5).fill('');

          return (
            <View key={row} style={styles.boardRow} testID={`board-row-${row}`}>
              {Array.from({ length: 5 }, (_, col) => {
                const letter = tiles[col];
                const isLocked = isCurrent && state.locked[col] !== null;
                const tileState: TileState = submitted
                  ? state.tileColors[row][col]
                  : letter
                  ? isLocked ? 'correct' : 'pending'
                  : 'empty';
                return (
                  <View
                    key={col}
                    style={[
                      styles.tile,
                      { backgroundColor: TILE_BG[tileState], borderColor: TILE_BORDER[tileState] },
                    ]}
                    testID={`tile-${row}-${col}`}
                  >
                    <Text style={styles.tileLetter}>{letter.toUpperCase()}</Text>
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>

      <Keyboard keyColors={state.keyColors} onKey={handleKey} disabled={gameOver} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#121213', paddingHorizontal: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#121213' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  hardLabel: { color: '#818384', fontSize: 13 },
  hardOn: { color: '#538D4E' },
  banner: { backgroundColor: '#fff', borderRadius: 4, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8 },
  bannerText: { color: '#121213', fontWeight: '700' },
  board: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  boardRow: { flexDirection: 'row', gap: 5 },
  tile: { width: 60, height: 60, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tileLetter: { color: '#fff', fontSize: 28, fontWeight: '700' },
  msg: { color: '#fff', fontSize: 16 },
  link: { color: '#538D4E', marginTop: 12, fontSize: 16 },
});
