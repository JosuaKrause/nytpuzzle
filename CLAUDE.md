# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run lint          # ESLint across src/ and scripts/
npm run lint:fix      # Auto-fix lint errors
npm test              # Run all tests
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

This is an Expo 54 / React Native project targeting Android (sideloaded APK). The codebase is in early scaffolding — only the API client layer exists so far.

### NYT API layer (`src/services/nytClient.ts`)

Single file that wraps all four NYT puzzle APIs. Key facts discovered from live responses:

| Game | Endpoint | Auth |
|------|----------|------|
| Wordle | `svc/wordle/v2/YYYY-MM-DD.json` | None |
| Connections | `svc/connections/v2/YYYY-MM-DD.json` | None |
| Strands | `svc/strands/v2/YYYY-MM-DD.json` | None |
| Mini | `svc/crosswords/v6/puzzle/mini/YYYY-MM-DD.json` | `X-Games-Auth-Bypass: true` header |
| Mini game state | `svc/crosswords/v6/game/{id}.json` | NYT-S + nyt-a cookies |

- **Wordle/Connections** field names use `snake_case`; **Strands** uses `camelCase` (`printDate`, `themeWords`, `startingBoard`).
- **Mini** response wraps everything in a `body: [MiniBody]` array (single-element tuple).
- Authentication uses two cookies: `NYT-S` (session, ~6–12 month TTL) and `nyt-a` (anonymous ID). Both go in `.env` as `NYT_S` and `NYT_A`. Scripts load them via `dotenv/config`.
- `svc/games/state` — **confirmed working** with NYT-S + nyt-a cookies:
  - **GET** `svc/games/state/{game}/latests?puzzle_ids={id}` → 200 — fetch saved state. Game names: `wordleV2`, `connections`, `strands`.
  - **POST** `svc/games/state` → 201 — sync state to server. Body: `{ game, game_data, puzzle_id, print_date, schema_version: "0.45.0", timestamp, user_id }`. `user_id` comes from the GET response.
- Mini game state works via the crossword endpoint above.

See [PLAN.md](PLAN.md) for the full app plan and planned service layer structure.

### Coverage

100% branch/function/line/statement coverage is enforced in `jest.config` (inside `package.json`). `App.tsx` and `index.ts` are excluded from coverage collection. All new files under `src/` are automatically included.
