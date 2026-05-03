import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { ConnectionsPuzzle } from '../services/nytClient';
import { getPuzzle, saveCompletion } from '../services/puzzleStore';
import {
  GameCard,
  RecordedGuess,
  RecordedSolvedCategory,
  cardsToPayload,
  checkGuess,
  extractCards,
  maxSameCategory,
  swapInOrder,
} from '../services/connections';

type Props = NativeStackScreenProps<RootStackParamList, 'Connections'>;
type GameStatus = 'loading' | 'error' | 'in_progress' | 'win' | 'fail';

interface State {
  puzzle: ConnectionsPuzzle | null;
  cards: GameCard[];
  boardOrder: number[];
  selected: number[];
  solvedLevels: number[];
  solvedCats: RecordedSolvedCategory[];
  guesses: RecordedGuess[];
  mistakes: number;
  status: GameStatus;
  message: string | null;
  arrangeMode: boolean;
  pickedUp: number | null;
}

const INITIAL: State = {
  puzzle: null, cards: [], boardOrder: [], selected: [],
  solvedLevels: [], solvedCats: [], guesses: [], mistakes: 0,
  status: 'loading', message: null, arrangeMode: false, pickedUp: null,
};

const LEVEL_COLOR = ['#F9DF6D', '#A0C35A', '#B0C4EF', '#BA81C5'];
const MAX_MISTAKES = 4;

export function ConnectionsScreen({ route, navigation }: Props) {
  const { date, dryRun = false } = route.params;
  const [state, setState] = useState<State>(INITIAL);

  useEffect(() => {
    getPuzzle<ConnectionsPuzzle>('connections', date).then(puzzle => {
      if (!puzzle) {
        setState(s => ({ ...s, status: 'error' }));
      } else {
        const cards = extractCards(puzzle.categories);
        setState(s => ({ ...s, puzzle, cards, boardOrder: cards.map((_, i) => i), status: 'in_progress' }));
      }
    });
  }, [date]);

  const handleCardPress = useCallback((cardIdx: number) => {
    setState(s => {
      if (s.arrangeMode) {
        if (s.pickedUp === null) return { ...s, pickedUp: cardIdx };
        if (s.pickedUp === cardIdx) return { ...s, pickedUp: null };
        return { ...s, boardOrder: swapInOrder(s.boardOrder, s.pickedUp, cardIdx), pickedUp: null };
      }
      if (s.selected.includes(cardIdx)) {
        return { ...s, selected: s.selected.filter(i => i !== cardIdx), message: null };
      }
      if (s.selected.length < 4) {
        return { ...s, selected: [...s.selected, cardIdx], message: null };
      }
      return s;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    setState(s => {
      const solvedLevel = checkGuess(s.selected, s.cards);
      const payload = cardsToPayload(s.selected, s.cards);

      if (solvedLevel !== null) {
        const newGuesses: RecordedGuess[] = [...s.guesses, { cards: payload, correct: true }];
        const newSolvedCats: RecordedSolvedCategory[] = [
          ...s.solvedCats,
          { cards: payload, level: solvedLevel, orderSolved: s.solvedCats.length + 1 },
        ];
        const newSolvedLevels = [...s.solvedLevels, solvedLevel];
        const newBoardOrder = s.boardOrder.filter(i => s.cards[i].level !== solvedLevel);
        const won = newSolvedLevels.length === 4;

        if (won && !dryRun) {
          saveCompletion('connections', date, String(s.puzzle!.id), {
            puzzleComplete: true, puzzleWon: true, mistakes: s.mistakes,
            guesses: newGuesses, solvedCategories: newSolvedCats, isPlayingArchive: false,
          });
        }

        return {
          ...s, guesses: newGuesses, solvedCats: newSolvedCats,
          solvedLevels: newSolvedLevels, boardOrder: newBoardOrder,
          selected: [], status: won ? 'win' : 'in_progress',
          message: won ? '🎉 Genius!' : null,
        };
      }

      const oneAway = maxSameCategory(s.selected, s.cards) === 3;
      const newMistakes = s.mistakes + 1;
      const fail = newMistakes >= MAX_MISTAKES;
      const newGuesses: RecordedGuess[] = [...s.guesses, { cards: payload, correct: false }];

      if (fail && !dryRun) {
        saveCompletion('connections', date, String(s.puzzle!.id), {
          puzzleComplete: true, puzzleWon: false, mistakes: newMistakes,
          guesses: newGuesses, solvedCategories: s.solvedCats, isPlayingArchive: false,
        });
      }

      return {
        ...s, guesses: newGuesses, mistakes: newMistakes, selected: [],
        status: fail ? 'fail' : 'in_progress',
        solvedLevels: fail ? [0, 1, 2, 3] : s.solvedLevels,
        boardOrder: fail ? [] : s.boardOrder,
        message: fail ? '😞 Better luck next time!' : oneAway ? 'One away!' : 'Wrong!',
      };
    });
  }, [date, dryRun]);

  const handleDeselectAll = useCallback(() => {
    setState(s => ({ ...s, selected: [], message: null }));
  }, []);

  const handleArrangeToggle = useCallback(() => {
    setState(s => ({ ...s, arrangeMode: !s.arrangeMode, selected: [], pickedUp: null }));
  }, []);

  if (state.status === 'loading') {
    return (
      <SafeAreaView style={styles.center} testID="loading">
        <Text style={styles.centerText}>Loading…</Text>
      </SafeAreaView>
    );
  }

  if (state.status === 'error') {
    return (
      <SafeAreaView style={styles.center} testID="error">
        <Text style={styles.centerText}>Puzzle not cached. Go back and preload first.</Text>
        <Pressable onPress={() => navigation.goBack()} testID="go-back">
          <Text style={styles.link}>← Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const gameOver = state.status === 'win' || state.status === 'fail';
  const mistakesRemaining = MAX_MISTAKES - state.mistakes;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Connections — {date}</Text>
        <View style={styles.headerRight}>
          {dryRun ? <Text style={styles.dryRunLabel}>DRY RUN</Text> : null}
          {!gameOver ? (
            <Pressable onPress={handleArrangeToggle} testID="arrange-toggle">
              <Text style={[styles.arrangeLabel, state.arrangeMode && styles.arrangeOn]}>
                {state.arrangeMode ? 'Done' : 'Arrange'}
              </Text>
            </Pressable>
          ) : null}
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

        {[0, 1, 2, 3].filter(l => state.solvedLevels.includes(l)).map(level => (
          <View
            key={level}
            style={[styles.solvedRow, { backgroundColor: LEVEL_COLOR[level] }]}
            testID={`solved-row-${level}`}
          >
            <Text style={styles.solvedTitle}>{state.puzzle!.categories[level].title.toUpperCase()}</Text>
            <Text style={styles.solvedWords}>
              {state.puzzle!.categories[level].cards.map(c => c.content).join(', ')}
            </Text>
          </View>
        ))}

        <View style={styles.grid} testID="grid">
          {state.boardOrder.map(cardIdx => {
            const card = state.cards[cardIdx];
            const isSelected = state.selected.includes(cardIdx);
            const isPickedUp = state.pickedUp === cardIdx;
            return (
              <Pressable
                key={cardIdx}
                testID={`card-${cardIdx}`}
                style={[styles.card, isSelected && styles.cardSelected, isPickedUp && styles.cardPickedUp]}
                onPress={() => handleCardPress(cardIdx)}
              >
                <Text style={[styles.cardText, isSelected && styles.cardTextSelected]}>
                  {card.content}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.mistakes}>
          <Text style={styles.mistakesLabel}>Mistakes remaining:</Text>
          <View style={styles.dots}>
            {Array.from({ length: MAX_MISTAKES }, (_, i) => (
              <View
                key={i}
                style={[styles.dot, i < mistakesRemaining ? styles.dotFilled : styles.dotEmpty]}
                testID={i < mistakesRemaining ? 'dot-filled' : 'dot-empty'}
              />
            ))}
          </View>
        </View>

        {!gameOver && !state.arrangeMode ? (
          <View style={styles.controls}>
            <Pressable
              style={styles.btnSecondary}
              onPress={handleDeselectAll}
              disabled={state.selected.length === 0}
              testID="deselect-button"
            >
              <Text style={styles.btnSecondaryText}>Deselect All</Text>
            </Pressable>
            <Pressable
              style={[styles.btnPrimary, state.selected.length < 4 && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={state.selected.length < 4}
              testID="submit-button"
            >
              <Text style={styles.btnPrimaryText}>Submit</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { fontSize: 16, textAlign: 'center', paddingHorizontal: 20 },
  link: { color: '#1D4ED8', marginTop: 12, fontSize: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '700' },
  dryRunLabel: { color: '#FBBF24', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  arrangeLabel: { fontSize: 13, color: '#6B7280' },
  arrangeOn: { color: '#1D4ED8', fontWeight: '600' },
  boardContainer: { flex: 1 },
  bannerOverlay: { position: 'absolute', top: 8, left: 0, right: 0, zIndex: 10, alignItems: 'center' },
  banner: { backgroundColor: '#333', borderRadius: 6, paddingHorizontal: 14, paddingVertical: 8 },
  bannerText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  solvedRow: { marginHorizontal: 8, marginBottom: 4, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
  solvedTitle: { fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  solvedWords: { fontSize: 13, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, gap: 4 },
  card: { width: '23.5%', aspectRatio: 1.1, backgroundColor: '#EFEFE6', borderRadius: 8, alignItems: 'center', justifyContent: 'center', padding: 4 },
  cardSelected: { backgroundColor: '#5A594E' },
  cardPickedUp: { backgroundColor: '#F59E0B' },
  cardText: { fontSize: 11, fontWeight: '700', textAlign: 'center', color: '#1a1a1a' },
  cardTextSelected: { color: '#fff' },
  footer: { paddingHorizontal: 16, paddingBottom: 12 },
  mistakes: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  mistakesLabel: { fontSize: 13, color: '#6B7280' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  dotFilled: { backgroundColor: '#5A594E' },
  dotEmpty: { backgroundColor: '#E5E7EB' },
  controls: { flexDirection: 'row', gap: 10 },
  btnSecondary: { flex: 1, borderWidth: 2, borderColor: '#333', borderRadius: 30, paddingVertical: 12, alignItems: 'center' },
  btnSecondaryText: { fontWeight: '600', fontSize: 15 },
  btnPrimary: { flex: 1, backgroundColor: '#333', borderRadius: 30, paddingVertical: 12, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#D1D5DB' },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
