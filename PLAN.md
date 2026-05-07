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
- `jest.setup.ts` mocks `Animated.timing`, `.spring`, `.delay`, and `.sequence`. Callbacks are **Promise-deferred** (values set immediately, callbacks via `Promise.resolve().then(...)`) so React renders intermediate animation states between callback batches, enabling animation-branch coverage. The jest config key is `setupFilesAfterEnv` — `setupFilesAfterFramework` is silently ignored.
- Two Wordle tests use a per-test `Animated.timing` override to capture specific callbacks and control when they fire (see `'covers isPrefillRevealed branch'` and `'covers prefillDone !== lockedCols.length'`).

## Dev / testing

- **Dry-run mode**: `DEV_DRY_RUN=true` in `.env` → yellow "DRY RUN" badge in game header; no `saveCompletion` calls. NOT an in-app toggle (cheat risk).
- **Date navigation**: HomeScreen ‹/› arrows, navigate any past date, preload, play.
- **Expo Go**: `npm start -- --clear` (--clear needed after package changes)

## Known issues / remaining work

### Active bugs
1. **Connections image puzzles** — Connections puzzle on 2026-05-06 (and similar dates) has empty cells because it's an image-based puzzle (cells contain images, not text). The current `ConnectionsScreen` only renders `card.label` (text). Need to inspect the raw API JSON for image puzzle schema to know what field carries the image URL/asset.

### Remaining features
5. **Strands** game implementation (grid word-finding UI; player draws lines through letters)
6. **Mini crossword** implementation (5×5 grid; separate sync via `svc/crosswords/v6/game/{id}`)
7. **Score sync trigger** — currently manual via `flush()`; needs a network-state listener (NetInfo)
8. **`user_id` for sync** — not stored yet; needs to be fetched once from GET state and cached
9. **Connections UX** — more visual grouping aids planned (e.g. visual grouping hypotheses)
