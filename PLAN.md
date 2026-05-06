# App Plan

## Goal

Android companion app (sideloaded APK, no Play Store required) that:
1. Pre-fetches puzzle data for all 4 games before going offline (e.g. subway)
2. Stores puzzles locally and lets you play them fully offline
3. Syncs completed scores back to NYT when back online

## Structure

```
src/
  services/
    nytClient.ts      # ✅ Typed API wrappers for all 4 games + state GET/POST
    puzzleStore.ts    # ✅ SQLite: puzzles + completions tables, sync status queries
    syncQueue.ts      # ✅ flush() — POST pending completions to NYT (skips mini)
    preloader.ts      # ✅ prefetchDate/prefetchRange — parallel fetch + store
    wordle.ts         # ✅ Pure Wordle game logic (colors, hard mode, green pre-fill)
    connections.ts    # ✅ Pure Connections game logic (guess check, one-away, swap, findCardAt)
  navigation/
    types.ts          # ✅ RootStackParamList (Home, Wordle, Connections, Strands, Mini)
  screens/
    HomeScreen.tsx    # ✅ Date picker (‹/›), per-game cache + sync status, Preload button
    WordleScreen.tsx  # ✅ Full game + animations (flip, prefill pop, shake on rejected input)
    ConnectionsScreen.tsx  # ✅ Full game + animations (LayoutAnimation moves, shake on wrong)
    StrandsScreen.tsx      # 🚧 Stub
    MiniScreen.tsx         # 🚧 Stub
  components/
    SyncBadge.tsx          # ✅ synced / pending / failed badge
    wordle/
      Keyboard.tsx         # ✅ Virtual keyboard with per-letter color state
```

## Service layer

**`puzzleStore.ts`** — expo-sqlite v16 tables:
- `puzzles(game, date, data JSON, fetched_at)` — raw puzzle data
- `completions(game, date, puzzle_id, result JSON, completed_at, synced_at, sync_status)`
- Internal game names: `wordle`, `connections`, `strands`, `mini` (NOT `wordleV2`)

**`syncQueue.ts`** — maps `wordle→wordleV2`, skips `mini`, returns `{synced, failed, skipped}`

**`preloader.ts`** — fetches all 4 games in parallel per date; individual failures isolated

## Gameplay details

### Wordle (`wordleV2`)
- Hard mode default, toggleable before first guess
- **Green pre-fill**: confirmed correct positions auto-fill next row — only type unknowns
- Banner floats over board (no layout shift)
- **Animations**: tile flip on submit, prefill pop on new locked tiles, shake on rejected input

### Connections ✅
- Tap to select (max 4), submit to guess; "One away!" feedback when 3/4 cards share a category
- **Drag-to-reorder**: long-press (150 ms delay) to pick up, drag to target, release to swap
- Blue border highlights the drop target while dragging
- **Animations**: LayoutAnimation slides cards to new positions on swap or correct-guess removal; grid shakes on wrong guess
- On fail: all remaining categories auto-revealed

### Strands — 🚧 not yet implemented
### Mini crossword — 🚧 not yet implemented

## Animations

### Wordle

**Tile flip (on every row submit)**
- 5 `Animated.Value`s (`flipAnims`, one per column), reused for each new row. Each goes 1 → 0 → 1 (scaleY).
- Phase 1 (1→0, 150 ms): tile squashes. Color still shows `pending`.
- Midpoint: `revealedCols[col]` flips to `true` in a `setRevealedCols` call inside the animation callback. The tile render switches from `pending` to the real `tileColors[row][col]`.
- Phase 2 (0→1, 150 ms): tile unsquashes in the final color.
- Stagger: 100 ms between columns → last tile completes at ~700 ms. `useNativeDriver: true` (only scaleY, no color interpolation needed — color switches via React state).

**Prefill pop (on new locked tiles)**
- `useEffect` on `state.locked` compares against `prevLockedRef` to find newly non-null positions.
- Those positions get `prefillAnims[col]` reset to 0 then `Animated.spring` to 1 (scale).
- `useNativeDriver: true`.

**Shake (rejected input only)**
- `rowShakeAnim` (translateX) oscillates ±8 px over 5 × 60 ms steps on the current board row.
- Fires on: not-enough-letters, hard-mode violation. **NOT on valid wrong guesses** — the flip is sufficient feedback.
- `shakingRow` state tracks which row wraps the shake transform; cleared in the `.start()` callback.

### Connections

**Card movement (swap + correct-guess removal)**
- `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)` called before every `setState` that changes `boardOrder`.
- Cards must all live in **one flat parent** (`flexWrap: 'wrap'`) — if they're in separate row `<View>`s, React unmounts/remounts them across parents and LayoutAnimation cannot track the move.
- Do **not** add `UIManager.setLayoutAnimationEnabledExperimental` — it's a no-op on the New Architecture and logs a warning.

**Shake (wrong guess)**
- `shakeAnim` on the grid `Animated.View`'s `translateX`. Same 5-step oscillation as Wordle.
- Only fires on non-fail wrong guesses (fail state shows the reveal instead).

### Testing
- `jest.setup.ts` mocks `Animated.timing`, `.spring`, `.delay`, and `.sequence` to run synchronously. Despite this, callbacks nested 4+ levels deep inside the main flip animation still don't complete within `act()` scope in the New Architecture test environment — see bug 2 above.

## Dev / testing

- **Dry-run mode**: `DEV_DRY_RUN=true` in `.env` → yellow "DRY RUN" badge in game header; no `saveCompletion` calls. NOT an in-app toggle (cheat risk).
- **Date navigation**: HomeScreen ‹/› arrows, navigate any past date, preload, play.
- **Expo Go**: `npm start -- --clear` (--clear needed after package changes)

## Known issues / remaining work

### Active bugs
1. **Connections card text empty** — Cards render but content may be invisible or the puzzle data didn't load for today's date. Needs investigation: either a data/caching issue or the API response schema changed.
2. **Wordle prefill animation coverage gap** — The prefill animation itself (locked tiles flip in after the main row flip with the same scaleY motion) is implemented and correct on device, but **coverage is failing** at 98.67% stmts / 94.49% branch / 94.73% fn. Lines 151–155 (prefill flip callbacks inside `done===5`) and line 347 (tile tileState `'correct'` branch while prefill is pending) are uncovered in tests. Root cause: animation callbacks nested 4+ levels deep inside `Animated.sequence.start()` callbacks are deferred asynchronously by React Native's New Architecture scheduler even when `Animated.timing`, `.spring`, `.delay`, and `.sequence` are all mocked to run synchronously in `jest.setup.ts`. The mocked outer sequence callback fires, but the timing callbacks chained inside it do not complete within the test's `act()` scope before the test ends. Options to resolve:
   - Restructure `startFlip` to avoid deeply nested animation callback chains (e.g. use `Animated.parallel` for all 5 columns' phase-1, then a single callback to start phase-2)
   - Drive the prefill animation from a `useEffect` triggered by a state flag, so it runs at the React commit level rather than inside an animation callback
   - Use `jest.useFakeTimers()` + `jest.runAllTimers()` in affected tests to advance all deferred callbacks

### Remaining features
5. **Strands** game implementation (grid word-finding UI; player draws lines through letters)
6. **Mini crossword** implementation (5×5 grid; separate sync via `svc/crosswords/v6/game/{id}`)
7. **Score sync trigger** — currently manual via `flush()`; needs a network-state listener (NetInfo)
8. **`user_id` for sync** — not stored yet; needs to be fetched once from GET state and cached
9. **Connections UX** — more visual grouping aids planned (e.g. visual grouping hypotheses)
