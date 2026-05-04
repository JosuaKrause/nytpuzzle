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
    WordleScreen.tsx  # ✅ Full game — board, virtual keyboard, hard mode, green pre-fill
    ConnectionsScreen.tsx  # ✅ Full game — drag-to-reorder (long-press), select/submit, one-away, fail reveal
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

### Connections ✅
- Tap to select (max 4), submit to guess; "One away!" feedback
- **Drag-to-reorder** (PanResponder, no native deps): long-press to pick up, drag to target, release to swap
  - Ghost card rendered at SafeAreaView root so absolute screen coords from `measure()` align directly
  - `onLayout` on each card calls `measure()` to store absolute screen coords in `cardLayouts` — ensures `findCardAt` works correctly across all 4 grid rows
  - Cards laid out as 4 explicit `<View flexDirection="row">` rows of 4 cards, each card `flex: 1` — eliminates any width calculation
- Drop-target card highlighted (blue border) while dragging
- On fail: all remaining categories auto-revealed

### Strands — 🚧 not yet implemented
### Mini crossword — 🚧 not yet implemented

## Animations — 🚧 planned

### Wordle

**Tile flip (on row submit)**
- One `Animated.Value` per tile column (5 total, reused per row). Range: −1 → 1.
  - Phase 1 (−1 → 0, 150 ms): `scaleY` 1→0 (squash), color stays `pending`
  - At midpoint (value crosses 0): color switches to final result via interpolation
  - Phase 2 (0 → 1, 150 ms): `scaleY` 0→1 (unsquash), color stays final
- Stagger: each tile starts 100 ms after the previous → total ~700 ms for 5 tiles
- `useNativeDriver: false` (required for background-color interpolation)
- Tile render: `Animated.View` for the row being flipped; regular `View` for all others

**Pre-fill pop (after flip completes)**
- After the flip sequence finishes, newly locked tiles in the next row pop in
- `Animated.spring` on `scale` (0.5 → 1), `useNativeDriver: true`
- Stagger matches the locked positions left-to-right

**Shake (wrong guess / not-enough-letters / hard-mode violation)**
- Applied to the current row's container
- `translateX` oscillation: 0 → −8 → 8 → −8 → 8 → 0, five 60 ms steps
- `useNativeDriver: true`
- Triggered before the game-state update so the row being shaken is still the current row

### Connections

**Card movement (swap + correct-guess removal)**
- `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)` called before any `setState` that changes `boardOrder` (drag swap) or removes cards (correct guess)
- Requires one-time call in `App.tsx`:
  ```ts
  if (Platform.OS === 'android') {
    UIManager.setLayoutAnimationEnabledExperimental?.(true);
  }
  ```

**Shake (wrong guess)**
- One shared `Animated.Value` on the grid container's `translateX`
- Same 5-step oscillation as Wordle (300 ms total)
- Applied to the `<View testID="grid">` wrapper

### Testing strategy
- All animation `Animated.Value` refs hold constant values outside of active animations, so existing tests need no changes for non-animating paths
- Tests that need animation callbacks to fire (e.g. flip midpoint, shake completion) use `jest.useFakeTimers()` + `jest.runAllTimers()` wrapped in `act()`
- 100% coverage target is unchanged

## Dev / testing

- **Dry-run mode**: `DEV_DRY_RUN=true` in `.env` → yellow "DRY RUN" badge in game header; no `saveCompletion` calls. NOT an in-app toggle (cheat risk).
- **Date navigation**: HomeScreen ‹/› arrows, navigate any past date, preload, play.
- **Expo Go**: `npm start -- --clear` (--clear needed after package changes)

## Known issues / remaining work

1. **Animations** — Wordle flip + pre-fill + shake; Connections LayoutAnimation + shake (see above)
2. **Strands** game implementation (grid word-finding UI; player draws lines through letters)
3. **Mini crossword** implementation (5×5 grid; separate sync via `svc/crosswords/v6/game/{id}`)
4. **Score sync trigger** — currently manual via `flush()`; needs a network-state listener (NetInfo)
5. **`user_id` for sync** — not stored yet; needs to be fetched once from GET state and cached (returns in `states[].user_id` or top-level `user_id`)
6. **Connections UX** — more visual grouping aids planned once animations are done
