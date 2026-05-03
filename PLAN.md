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
    connections.ts    # ✅ Pure Connections game logic (guess check, one-away, swap)
  navigation/
    types.ts          # ✅ RootStackParamList (Home, Wordle, Connections, Strands, Mini)
  screens/
    HomeScreen.tsx    # ✅ Date picker (‹/›), per-game cache + sync status, Preload button
    WordleScreen.tsx  # ✅ Full game — board, virtual keyboard, hard mode, green pre-fill
    ConnectionsScreen.tsx  # ✅ Full game — card grid, arrange mode (drag-to-swap), one-away
    StrandsScreen.tsx      # 🚧 Stub
    MiniScreen.tsx         # 🚧 Stub
  components/
    SyncBadge.tsx          # ✅ synced / pending / failed badge
    wordle/
      Keyboard.tsx         # ✅ Virtual keyboard with per-letter color state
```

## Service layer

**`puzzleStore.ts`** — expo-sqlite tables:
- `puzzles(game, date, data JSON, fetched_at)` — raw puzzle data keyed by `(game, date)`
- `completions(game, date, puzzle_id, result JSON, completed_at, synced_at, sync_status)`
- Internal game names: `wordle`, `connections`, `strands`, `mini`

**`syncQueue.ts`** — score sync flow:
1. Game completion → `saveCompletion(game, date, puzzleId, gameData)`
2. `flush(nytS, nytA, userId)` processes all `pending`/`failed` rows
3. Maps `wordle` → `wordleV2` for the NYT API; skips `mini` (different endpoint)
4. `POST /svc/games/state` → 201 → mark `synced`; error → mark `failed`, retry later

**`preloader.ts`** — `prefetchDate(date, nytS?, nytA?)` fetches all 4 games in parallel, stores each. Individual failures are isolated (partial success). `prefetchRange(startDate, days)` runs dates sequentially.

## Gameplay details

### Wordle (`wordleV2`)
- Hard mode enabled by default, toggleable before first guess
- **Green pre-fill**: after each submission, confirmed correct positions auto-fill the next row — you only type the unknown letters
- Banner floats over board (no layout shift)
- `game_data`: `{ boardState, currentRowIndex, hardMode, isPlayingArchive, status }`

### Connections
- Tap to select (max 4), submit to guess
- **Arrange mode**: tap "Arrange" → tap card to pick up (amber) → tap another to swap positions → tap "Done". Visual groupings persist across the session.
- Wrong guess shows "Wrong!" or "One away!" (3/4 correct)
- On fail: all remaining categories revealed
- `game_data`: `{ puzzleComplete, puzzleWon, mistakes, guesses, solvedCategories, isPlayingArchive }`

### Strands — 🚧 not yet implemented
### Mini crossword — 🚧 not yet implemented

## Dev / testing

- **Dry-run mode**: set `DEV_DRY_RUN=true` in `.env`. App shows a yellow "DRY RUN" badge; no `saveCompletion` calls are made. Lets you replay already-solved puzzles without affecting NYT stats. Not accessible as an in-app toggle (would allow pre-solving to game the stats).
- **Date navigation**: HomeScreen has ‹/› arrows. Navigate to any past date, preload, and play.
- **Expo Go**: `npm start`, scan QR on device.

## Open questions / remaining work

- Strands game implementation (grid word-finding UI)
- Mini crossword implementation (5×5 crossword UI, separate sync via `svc/crosswords/v6/game/{id}`)
- Score sync trigger (currently manual via `flush()`; needs a network-state listener)
- `user_id` for sync — currently not stored; needs to be fetched once from GET state and cached
