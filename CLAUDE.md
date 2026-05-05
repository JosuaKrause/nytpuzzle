# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run lint          # ESLint across src/ and scripts/
npm run lint:fix      # Auto-fix lint errors
npm test              # Run all tests (warns-as-errors configured)
npm run test:watch    # Watch mode
npm run coverage      # Run tests with coverage (100% required — fails if not met)

npx ts-node scripts/fetch-puzzle.ts [YYYY-MM-DD]   # Fetch all 4 puzzle types for a date
npx ts-node scripts/test-auth.ts [YYYY-MM-DD]      # Verify credentials and Mini game state
npx ts-node scripts/fetch-state.ts <puzzle-id>     # Fetch Mini game state by puzzle ID
```

Run a single test file:
```bash
npx jest src/services/nytClient.test.ts
```

Node version is pinned to 22 via `.nvmrc`. Run `nvm use` before any npm command if your shell does not auto-load it.

Install with `npm install --legacy-peer-deps` — the flag is required due to a react-test-renderer peer dep conflict between `@testing-library/react-native` and React 19.1.x (Expo 54's version).

## Architecture

Expo 54 / React Native app targeting Android (sideloaded APK). See [PLAN.md](PLAN.md) for the full feature plan.

### NYT API layer (`src/services/nytClient.ts`)

Typed wrappers for all four puzzle endpoints and the games-state sync API.

| Game | Puzzle endpoint | Auth |
|------|----------------|------|
| Wordle | `svc/wordle/v2/YYYY-MM-DD.json` | None |
| Connections | `svc/connections/v2/YYYY-MM-DD.json` | None |
| Strands | `svc/strands/v2/YYYY-MM-DD.json` | None |
| Mini | `svc/crosswords/v6/puzzle/mini/YYYY-MM-DD.json` | `X-Games-Auth-Bypass: true` |
| Mini game state | `svc/crosswords/v6/game/{id}.json` | NYT-S + nyt-a cookies |

- **Wordle/Connections** field names: `snake_case`. **Strands**: `camelCase` (`printDate`, `themeWords`, `startingBoard`).
- **Mini** response: wrapped in `body: [MiniBody]` (single-element array).
- Auth cookies: `NYT-S` (session, ~6–12 month TTL) and `nyt-a` (anonymous ID). Stored in `.env` as `NYT_S` and `NYT_A`. Scripts load via `dotenv/config`. App reads via `expo-constants` / `app.config.js`.
- `svc/games/state` — confirmed working with cookies:
  - **GET** `svc/games/state/{game}/latests?puzzle_ids={id}` → 200
  - **POST** `svc/games/state` → 201. Body: `{ game, game_data, puzzle_id, print_date, schema_version: "0.45.0", timestamp, user_id }`
  - Game names for state API: `wordleV2`, `connections`, `strands` (no mini)
  - `user_id` comes from the GET response top-level field

`game_data` shapes (confirmed from live browser capture):
- **Wordle**: `{ boardState: string[], currentRowIndex, hardMode, isPlayingArchive, status: "WIN"|"FAIL"|"IN_PROGRESS" }`
- **Connections**: `{ puzzleComplete, puzzleWon, mistakes, guesses: [{cards:[{position,level}], correct}], solvedCategories: [{cards, level, orderSolved}], isPlayingArchive }`
- **Strands**: `{ history: [{t:"THEME"|"SPANGRAM"|"HINT", w:string}], isPlayingArchive, isSolved, otherWordsFound }`

### Storage (`src/services/puzzleStore.ts`)

expo-sqlite v16 (async API). Two tables:

```sql
puzzles(game TEXT, date TEXT, data TEXT, fetched_at INTEGER, PRIMARY KEY (game, date))
completions(game TEXT, date TEXT, puzzle_id TEXT, result JSON, completed_at INTEGER,
            synced_at INTEGER, sync_status TEXT, PRIMARY KEY (game, date))
```

Internal game name convention: `wordle`, `connections`, `strands`, `mini` (NOT `wordleV2`). The `syncQueue` maps to NYT API names on the way out.

### Sync queue (`src/services/syncQueue.ts`)

`flush(nytS, nytA, userId)` processes all `pending`/`failed` completions. Returns `{ synced, failed, skipped }`. Skipped = `mini` (uses a different API). Maps `wordle → wordleV2` for the POST.

### Navigation (`src/navigation/types.ts`)

```typescript
RootStackParamList = {
  Home: undefined
  Wordle: { date: string; dryRun?: boolean }
  Connections: { date: string; dryRun?: boolean }
  Strands: { date: string; dryRun?: boolean }
  Mini: { date: string; dryRun?: boolean }
}
```

### Dry-run mode

Set `DEV_DRY_RUN=true` in `.env`. Injected at build time via `app.config.js` → `expo-constants`. When active:
- A yellow "DRY RUN" badge appears in the game screen header
- `saveCompletion` is never called — scores are not recorded or synced
- Not available as an in-app toggle (would allow pre-solving before a "real" attempt)

### Game-specific notes

**Wordle** (`src/services/wordle.ts` + `src/screens/WordleScreen.tsx`):
- Hard mode on by default; locked after first guess
- **Green pre-fill**: confirmed correct positions auto-populate the next row; the user only types remaining unknowns. Locked tiles show as amber, immune to backspace.
- **`stateRef` pattern**: `stateRef.current = state` kept up-to-date at each render. `handleKey` reads from `stateRef.current` for the ENTER path so it can compute animation setup and call `setState` directly (no functional updater needed for ENTER since state is always fresh at key-press time). Letter/backspace still use the functional updater `setState(s => ...)` to handle rapid presses safely.
- **Animations**:
  - *Flip*: `flipAnims` (5 `Animated.Value`s, scaleY). On submit, each column squashes (1→0), then `setRevealedCols` flips that column's boolean so the tile switches from `pending` to its real color, then unsquashes (0→1). Stagger: 100 ms/column. `useNativeDriver: true`.
  - *Prefill pop*: `useEffect` on `state.locked` diffs against `prevLockedRef`; newly locked columns get `prefillAnims[col]` sprung from 0→1 (scale). `useNativeDriver: true`.
  - *Shake*: `rowShakeAnim` (translateX) on the `shakingRow`. Fires **only on rejected input** (not-enough-letters, hard-mode violation) — **not** on valid wrong guesses. Cleared via `.start()` callback.

**Connections** (`src/services/connections.ts` + `src/screens/ConnectionsScreen.tsx`):
- Tap to select (max 4), submit to guess. "One away!" shown when 3/4 selected cards share a category.
- **Drag-to-reorder** (PanResponder, no native deps): `delayLongPress={150}` on each card (down from the 500 ms default). Ghost card rendered at `SafeAreaView` root so `pageX/pageY` from `measure()` map directly to absolute screen coords.
- **Card `onLayout`** calls `measure()` on the card's own ref to store absolute screen coords in `cardLayouts`. This is required because `findCardAt` receives `pageX/pageY` (screen-absolute); storing layout-relative coords would give wrong hit targets for rows 2–4.
- **Grid layout**: `flexDirection: 'row', flexWrap: 'wrap'` with `onLayout`-measured `cardWidth`. All 16 cards are direct children of one `Animated.View`. This is a hard requirement for `LayoutAnimation` — if cards are in separate row `<View>`s, swaps cause cross-parent unmount/remount which LayoutAnimation cannot animate as a slide.
- **`stateRef` pattern**: `handleSubmit` reads `stateRef.current` directly so it can call `LayoutAnimation.configureNext(...)` before `setState` (must happen in the same synchronous call, before the render that triggers the layout change).
- **Animations**:
  - *Card moves*: `LayoutAnimation.configureNext(easeInEaseOut)` before any `setState` that modifies `boardOrder` (drag swap, correct-guess removal).
  - *Shake*: `shakeAnim` on grid `translateX`. Fires on non-fail wrong guesses only.
  - Do **not** add `UIManager.setLayoutAnimationEnabledExperimental` — it is a no-op on the New Architecture and logs a warning.
- On fail (4 mistakes): all remaining categories auto-reveal.

### End-of-work-item checklist

After completing any work item, update:
- **PLAN.md** — add new known issues or planned work; remove stale descriptions. Before marking anything ✅, **ask the user to confirm the fix/feature is working as expected on device** — do not assume it is complete just because tests pass.
- **CLAUDE.md** — update architecture/game notes if implementation details changed
- **Memory** (`~/.claude/projects/.../memory/project_nyt_app.md`) — current state, resolved bugs, next work

### Coverage

100% branch/function/line/statement coverage enforced in `jest.config` (inside `package.json`). `console.warn` throws in tests (configured in `jest.setup.ts`). Excluded from coverage: `App.tsx`, `index.ts`, `src/navigation/types.ts`. All other files under `src/` are automatically included.

**Animation coverage**: `jest.setup.ts` mocks `Animated.timing`, `.spring`, and `.delay` to execute synchronously (callbacks fire immediately). This allows all animation callbacks — including per-tile flip midpoints and shake completion — to be covered by existing test events without fake timers. Do not remove these mocks.
