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
    ConnectionsScreen.tsx  # ⚠️ Full game logic done, drag-and-drop has layout bugs (see below)
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

### Connections ✅ logic, ⚠️ layout bugs
- Tap to select (max 4), submit to guess; "One away!" feedback
- **Drag-and-drop** (PanResponder, no native deps): long-press to pick up, drag, release to swap
  - Cards rearranged without committing to a guess
  - No separate "Arrange" mode button
- On fail: all remaining categories auto-revealed
- **BUG 1 — Grid renders 3 columns instead of 4**
  - Tried `width: '23.5%' + margin: 2` — overflows (pct × 4 + margins > container)
  - Tried `Dimensions.get('window').width` static calculation — still 3 cols on device
  - Candidate fixes to try next:
    - Use `onLayout` on the grid container to get actual width dynamically at runtime, compute card width from that (avoids `Dimensions` being wrong at startup)
    - Render 4 explicit rows of 4 (nested Views: `flexDirection: 'row'` × 4) — sidesteps flexWrap entirely
    - Use `flex: 1` on cards inside a row View
- **BUG 2 — Ghost card appears in wrong position**
  - Ghost is inside `boardContainer` which is NOT at screen origin (header above it)
  - Using `pageX/pageY` from `measure()` (absolute screen coords) as the ghost position
  - Tried subtracting `boardOffset` (boardContainer's measured screen position) — made it worse, suspect sign or timing issue
  - Candidate fixes:
    - Render ghost card at the **SafeAreaView root level** (outside boardContainer entirely) — absolute coords from `measure()` will then match directly since it's closer to screen root
    - Use `useRef` for ghost position (not `Animated.ValueXY`) and `setNativeProps` to update without re-render

### Strands — 🚧 not yet implemented
### Mini crossword — 🚧 not yet implemented

## Dev / testing

- **Dry-run mode**: `DEV_DRY_RUN=true` in `.env` → yellow "DRY RUN" badge in game header; no `saveCompletion` calls. NOT an in-app toggle (cheat risk).
- **Date navigation**: HomeScreen ‹/› arrows, navigate any past date, preload, play.
- **Expo Go**: `npm start -- --clear` (--clear needed after package changes)

## Known issues / remaining work

1. **Connections grid 3-col bug** — fix grid layout (see BUG 1 above)
2. **Connections ghost offset bug** — fix ghost position (see BUG 2 above)
3. **Strands** game implementation (grid word-finding UI; player draws lines through letters)
4. **Mini crossword** implementation (5×5 grid; separate sync via `svc/crosswords/v6/game/{id}`)
5. **Score sync trigger** — currently manual via `flush()`; needs a network-state listener (NetInfo)
6. **`user_id` for sync** — not stored yet; needs to be fetched once from GET state and cached (returns in `states[].user_id` or top-level `user_id`)
7. **Connections custom features** — user wants to add more UX improvements beyond drag-and-drop (e.g., visual grouping aids). Table until core bugs are fixed.
