# App Plan

## Goal

Android companion app (sideloaded APK, no Play Store required) that:
1. Pre-fetches puzzle data for all 4 games before going offline (e.g. subway)
2. Stores puzzles locally so they're playable without internet
3. Tracks score sync status with a clear indicator (synced / pending / failed)

## Planned structure

```
src/
  services/
    nytClient.ts      # ✅ done — typed API wrappers
    puzzleStore.ts    # SQLite storage for offline puzzle data
    syncQueue.ts      # Queue for pending score submissions
    preloader.ts      # Pre-fetch puzzles on WiFi
  screens/            # HomeScreen + per-game screens
  components/         # SyncBadge (synced / pending / failed)
```

## Service layer design

**`puzzleStore.ts`** — expo-sqlite tables:
- `puzzles(game, date, data JSON, fetched_at)` — raw puzzle data
- `completions(game, date, result JSON, completed_at, synced_at, sync_status)` — local results + sync state

**`syncQueue.ts`** — score sync flow:
1. On puzzle completion → write to `completions` with `sync_status = 'pending'`
2. Network comes back → process pending rows
3. POST to NYT state endpoint with NYT-S + nyt-a cookies
4. HTTP 200 → `sync_status = 'synced'`, record `synced_at`
5. Failure → `sync_status = 'failed'`, retry on next connection

**`preloader.ts`** — on app open with WiFi → fetch today + next 2 days for all 4 games and store in `puzzles` table.

## Open questions

- Score POST body format for Wordle/Connections/Strands needs reverse-engineering (browser network inspection during game completion). `svc/games/state` returns 500 "unauthorized" with current auth — exact mechanism unknown.
- Mini game state works via `svc/crosswords/v6/game/{id}.json` (confirmed).
