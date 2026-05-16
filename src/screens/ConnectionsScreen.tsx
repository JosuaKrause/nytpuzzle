import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  LayoutAnimation,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SvgUri } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { ConnectionsPuzzle } from '../services/nytClient';
import { getPuzzle, saveCompletion } from '../services/puzzleStore';
import {
  CardLayout,
  GameCard,
  RecordedGuess,
  RecordedSolvedCategory,
  cardsToPayload,
  checkGuess,
  extractCards,
  findCardAt,
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
}

const INITIAL: State = {
  puzzle: null, cards: [], boardOrder: [], selected: [],
  solvedLevels: [], solvedCats: [], guesses: [], mistakes: 0,
  status: 'loading', message: null,
};

const LEVEL_COLOR = ['#F9DF6D', '#A0C35A', '#B0C4EF', '#BA81C5'];
const MAX_MISTAKES = 4;

const SHAKE = [
  { toValue: -8, duration: 60 },
  { toValue: 8,  duration: 60 },
  { toValue: -8, duration: 60 },
  { toValue: 8,  duration: 60 },
  { toValue: 0,  duration: 60 },
] as const;

export function ConnectionsScreen({ route, navigation }: Props) {
  const { date, dryRun = false } = route.params;
  const [state, setState] = useState<State>(INITIAL);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Grid width measured via onLayout so cardWidth is always correct on device
  const [gridWidth, setGridWidth] = useState(Dimensions.get('window').width);

  // Drag state ----------------------------------------------------------------
  const cardLayouts = useRef<Map<number, CardLayout>>(new Map());
  const cardViewRefs = useRef<Map<number, View>>(new Map());
  const ghostAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const ghostSize = useRef({ width: 0, height: 0 });
  const dragRef = useRef<{ cardIdx: number; startX: number; startY: number } | null>(null);
  const [activeDrag, setActiveDrag] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  // Animation -----------------------------------------------------------------
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const runShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence(
      SHAKE.map(({ toValue, duration }) =>
        Animated.timing(shakeAnim, { toValue, duration, useNativeDriver: true }),
      ),
    ).start();
  }, [shakeAnim]);

  // ---------------------------------------------------------------------------

  const gridPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => dragRef.current !== null,
      onPanResponderMove: (evt, gs) => {
        if (!dragRef.current) return;
        ghostAnim.setValue({
          x: dragRef.current.startX + gs.dx,
          y: dragRef.current.startY + gs.dy,
        });
        const target = findCardAt(evt.nativeEvent.pageX, evt.nativeEvent.pageY, cardLayouts.current);
        setDropTarget(target !== dragRef.current.cardIdx ? target : null);
      },
      onPanResponderRelease: (evt) => {
        if (!dragRef.current) return;
        const target = findCardAt(evt.nativeEvent.pageX, evt.nativeEvent.pageY, cardLayouts.current);
        const srcIdx = dragRef.current.cardIdx;
        if (target !== null && target !== srcIdx) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setState(s => ({ ...s, boardOrder: swapInOrder(s.boardOrder, srcIdx, target) }));
        }
        dragRef.current = null;
        setActiveDrag(null);
        setDropTarget(null);
      },
      onPanResponderTerminate: () => {
        dragRef.current = null;
        setActiveDrag(null);
        setDropTarget(null);
      },
    }),
  ).current;

  const startDrag = useCallback((cardIdx: number) => {
    cardViewRefs.current.get(cardIdx)?.measure((_fx, _fy, w, h, px, py) => {
      ghostSize.current = { width: w, height: h };
      dragRef.current = { cardIdx, startX: px, startY: py };
      ghostAnim.setValue({ x: px, y: py });
      setActiveDrag(cardIdx);
    });
  }, [ghostAnim]);

  // ---------------------------------------------------------------------------

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
    if (activeDrag !== null) return;
    setState(s => {
      if (s.selected.includes(cardIdx)) {
        return { ...s, selected: s.selected.filter(i => i !== cardIdx), message: null };
      }
      if (s.selected.length < 4) {
        return { ...s, selected: [...s.selected, cardIdx], message: null };
      }
      return s;
    });
  }, [activeDrag]);

  const handleSubmit = useCallback(() => {
    const s = stateRef.current;
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

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setState({
        ...s, guesses: newGuesses, solvedCats: newSolvedCats,
        solvedLevels: newSolvedLevels, boardOrder: newBoardOrder,
        selected: [], status: won ? 'win' : 'in_progress',
        message: won ? '🎉 Genius!' : null,
      });
      return;
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

    setState({
      ...s, guesses: newGuesses, mistakes: newMistakes, selected: [],
      status: fail ? 'fail' : 'in_progress',
      solvedLevels: fail ? [0, 1, 2, 3] : s.solvedLevels,
      boardOrder: fail ? [] : s.boardOrder,
      message: fail ? '😞 Better luck next time!' : oneAway ? 'One away!' : 'Wrong!',
    });
    if (!fail) runShake();
  }, [date, dryRun, runShake]);

  const handleDeselectAll = useCallback(() => {
    setState(s => ({ ...s, selected: [], message: null }));
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
  const cardWidth = Math.floor((gridWidth - GRID_H_PAD * 2 - CARD_GAP * 3) / 4);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Connections — {date}</Text>
        {dryRun ? <Text style={styles.dryRunLabel}>DRY RUN</Text> : null}
      </View>

      <View testID="board-container" style={styles.boardContainer}>
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
              {state.cards
                .filter(c => c.level === level)
                .map(c => c.imageAlt ?? c.content)
                .join(', ')}
            </Text>
          </View>
        ))}

        {/* gridWrapper centers the grid vertically without putting justifyContent
            on boardContainer itself — that would break LayoutAnimation position
            resolution on the new architecture */}
        <View style={styles.gridWrapper}>
        {/* flexWrap keeps all cards in one parent so LayoutAnimation can track
            them across reorders — explicit row Views would cause cross-parent
            unmount/remount which LayoutAnimation cannot animate */}
        {/* Animated.View carries only the shake transform so LayoutAnimation
            can track child positions on Fabric without interference from a
            native-driven animated parent */}
        <Animated.View
          {...gridPan.panHandlers}
          style={{ transform: [{ translateX: shakeAnim }] }}
        >
        <View
          style={styles.grid}
          testID="grid"
          onLayout={e => setGridWidth(e.nativeEvent.layout.width)}
        >
          {state.boardOrder.map(cardIdx => {
            const card = state.cards[cardIdx];
            const isSelected = state.selected.includes(cardIdx);
            const isBeingDragged = activeDrag === cardIdx;
            const isDropTarget = dropTarget === cardIdx;

            return (
              <Pressable
                key={cardIdx}
                ref={el => {
                  if (el) cardViewRefs.current.set(cardIdx, el as unknown as View);
                  else cardViewRefs.current.delete(cardIdx);
                }}
                testID={`card-${cardIdx}`}
                style={[
                  styles.card,
                  { width: cardWidth },
                  isSelected && styles.cardSelected,
                  isBeingDragged && styles.cardDragging,
                  isDropTarget && styles.cardDropTarget,
                ]}
                onPress={() => handleCardPress(cardIdx)}
                delayLongPress={150}
                onLongPress={() => startDrag(cardIdx)}
                onLayout={() => {
                  cardViewRefs.current.get(cardIdx)?.measure((_fx, _fy, w, h, px, py) => {
                    cardLayouts.current.set(cardIdx, { x: px, y: py, width: w, height: h });
                  });
                }}
              >
                {card.imageUrl ? (
                  <SvgUri
                    width="90%"
                    height="90%"
                    uri={card.imageUrl}
                    accessible
                    accessibilityLabel={card.imageAlt}
                  />
                ) : (
                  <View style={styles.cardTextWrap}>
                    <Text style={[styles.cardText, isSelected && styles.cardTextSelected]}>
                      {card.content}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
        </Animated.View>
        </View>
      </View>

      {activeDrag !== null ? (
        <Animated.View
          testID="ghost-card"
          pointerEvents="none"
          style={[
            styles.ghostCard,
            {
              width: ghostSize.current.width,
              height: ghostSize.current.height,
              transform: [{ translateX: ghostAnim.x }, { translateY: ghostAnim.y }],
            },
          ]}
        >
          {state.cards[activeDrag]?.imageUrl ? (
            <SvgUri
              width="90%"
              height="90%"
              uri={state.cards[activeDrag]!.imageUrl!}
              accessible
              accessibilityLabel={state.cards[activeDrag]?.imageAlt}
            />
          ) : (
            <Text style={styles.ghostText}>{state.cards[activeDrag]?.content}</Text>
          )}
        </Animated.View>
      ) : null}

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

        {!gameOver ? (
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

const GRID_H_PAD = 8;
const CARD_GAP = 4;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { fontSize: 16, textAlign: 'center', paddingHorizontal: 20 },
  link: { color: '#1D4ED8', marginTop: 12, fontSize: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, paddingTop: 24 },
  title: { fontSize: 22, fontWeight: '700' },
  dryRunLabel: { color: '#FBBF24', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  boardContainer: { flex: 1 },
  gridWrapper: { flex: 1, justifyContent: 'center', paddingTop: 40 },
  bannerOverlay: { position: 'absolute', top: 8, left: 0, right: 0, zIndex: 10, alignItems: 'center' },
  banner: { backgroundColor: '#333', borderRadius: 6, paddingHorizontal: 14, paddingVertical: 8 },
  bannerText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  solvedRow: { marginHorizontal: 8, marginBottom: 4, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
  solvedTitle: { fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  solvedWords: { fontSize: 13, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: GRID_H_PAD, gap: CARD_GAP },
  card: {
    aspectRatio: 1.1,
    backgroundColor: '#EFEFE6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  cardSelected: { backgroundColor: '#5A594E' },
  cardDragging: { opacity: 0.3 },
  cardDropTarget: { borderWidth: 2, borderColor: '#1D4ED8' },
  cardTextWrap: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  cardText: { fontSize: 11, fontWeight: '700', textAlign: 'center', color: '#1a1a1a' },
  cardTextSelected: { color: '#fff' },
  ghostCard: {
    position: 'absolute',
    backgroundColor: '#5A594E',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 100,
  },
  ghostText: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },
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
