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
    ConnectionsScreen.tsx  # ✅ Full game + overlay animations (swap slide, fade-out, shake on wrong)
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
- **Animations**: overlay layer animates card swaps and correct-guess fades; grid shakes on wrong guess (see Animations section)
- On fail: all remaining categories auto-revealed
- **Image puzzles**: cards with `image_url`/`image_alt_text` render `<SvgUri>` from `react-native-svg`; solved-row subtitle shows alt text values
- Grid is vertically centred via a `gridWrapper` (`flex: 1, justifyContent: 'center'`) — `justifyContent` must not be on `boardContainer` itself (causes layout issues on Fabric)

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

**Overlay animation layer** — real grid cards are never moved or transformed; a detached overlay layer (absolutely positioned at SafeAreaView root, `zIndex: 50`) renders animated copies.

**Card swap**
- On drag release: both swapping cards get `cardHidden: {opacity:0}` in the real grid; overlay copies slide from each card's measured screen position to the other's position (250 ms `translateX/Y`, `useNativeDriver: true`). After animation: `boardOrder` swaps, overlay clears, hidden cards reappear.
- Falls back to instant swap if the dragged card's layout hasn't been measured yet.

**Correct-guess fade** (current, pending improvement — see Active bugs)
- 4 selected cards get `cardHidden`; overlay copies fade to opacity 0 (200 ms). After animation: state commits (cards removed from `boardOrder`, solved row added).
- Only cards with entries in `cardLayouts` get overlay copies; the rest disappear instantly.

**Shake (wrong guess)**
- `shakeAnim` on the `Animated.View` wrapper around the grid (`translateX`). Same 5-step ±8 px oscillation as Wordle. Only fires on non-fail wrong guesses.

### Testing
- `jest.setup.ts` mocks `Animated.timing`, `.spring`, `.delay`, `.sequence`, and `.parallel`. Callbacks are **Promise-deferred** (values set immediately, callbacks via `Promise.resolve().then(...)`) so React renders intermediate animation states between callback batches, enabling animation-branch coverage. The jest config key is `setupFilesAfterEnv` — `setupFilesAfterFramework` is silently ignored.
- Two Wordle tests use a per-test `Animated.timing` override to capture specific callbacks and control when they fire (see `'covers isPrefillRevealed branch'` and `'covers prefillDone !== lockedCols.length'`).

## Dev / testing

- **Dry-run mode**: `DEV_DRY_RUN=true` in `.env` → yellow "DRY RUN" badge in game header; no `saveCompletion` calls. NOT an in-app toggle (cheat risk).
- **Date navigation**: HomeScreen ‹/› arrows, navigate any past date, preload, play.
- **Expo Go**: `npm start -- --clear` (--clear needed after package changes)

## Known issues / remaining work

### Active bugs

1. **Connections — solved groups display in difficulty order, not solve order** — solved rows are rendered by iterating `[0,1,2,3]` and filtering by `state.solvedLevels`, so they always appear yellow→green→blue→purple regardless of solve order. Since the color already conveys difficulty, the row order should reflect the order the player solved them. Fix: iterate `state.solvedCats` (already stored in solve order via `orderSolved`) and render one row per entry.

2. **Connections — solved rows shift the grid down** — as groups are solved, solved rows are added above the grid, pushing it down. The grid should stay in a fixed position throughout the game. Fix: always reserve space for 4 solved-row slots at the top (invisible placeholders before any are solved, same height as a real solved row). When a category is solved it fills in its slot in solve order. The grid never moves because the total height of the row region is always 4 × row height. Ties together with bug 1 fix.

3. **Connections — no fly-to-solved animation** — after the correct-guess fade, solved cards just disappear and the solved row appears. The actual NYT game animates the cards flying together from the grid to the position of the new solved row. Use the existing overlay layer: after the correct-guess fade, instead of immediately committing state, animate the 4 overlay cards converging to the centre of the target solved-row slot, then commit.

### Remaining features
5. **Strands** game implementation (grid word-finding UI; player draws lines through letters)
6. **Mini crossword** implementation (5×5 grid; separate sync via `svc/crosswords/v6/game/{id}`)
7. **Score sync trigger** — currently manual via `flush()`; needs a network-state listener (NetInfo)
8. **`user_id` for sync** — not stored yet; needs to be fetched once from GET state and cached
9. **Connections UX** — more visual grouping aids planned (e.g. visual grouping hypotheses)

## History

### Connections animations (2026-05-16/17)

**What didn't work:**
- **LayoutAnimation** — worked initially; broke after `react-native-svg` was added. Root cause never confirmed (native module conflicting with Fabric was suspected but removing the JS import alone while the native module stayed in the APK did not fix it, and rebuilding without the package was not viable since SVG images are required).
- **Moving `justifyContent: 'center'` from `boardContainer` to `gridWrapper`** — did not restore animations.
- **Separating shake `Animated.View` from the plain grid `View`** — did not restore animations.
- **FLIP technique** (snapshot positions before setState, set inverse transform, animate to zero) — appeared to work in tests but caused visual corruption on device after a few swaps: wrong cells highlighted, animations stopped firing.

**What worked:**
- **Overlay layer approach** — real grid is purely static (no transforms on real cards). Detached `Animated.View` copies are rendered absolutely at SafeAreaView root at measured screen coordinates. Real cards being animated are hidden with `opacity: 0`. Swap: two copies slide to swapped positions (250 ms). Correct-guess: four copies fade to 0 (200 ms). After each animation, overlay clears and real state updates. This is completely decoupled from the grid layout, so the grid never gets confused.
