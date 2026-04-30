#!/usr/bin/env ts-node
/**
 * Fetch and display Mini crossword game state (completion, solve time, sync status).
 * Usage: ts-node scripts/fetch-state.ts <puzzle-id>
 *
 * Get the puzzle ID by running: ts-node scripts/fetch-puzzle.ts
 * Reads NYT_S and NYT_A from .env.
 */
import 'dotenv/config';
import { fetchMiniGameState } from '../src/services/nytClient';

async function main() {
  const nytS = process.env.NYT_S;
  const nytA = process.env.NYT_A;

  if (!nytS) {
    console.error('NYT_S not set in .env');
    process.exit(1);
  }

  const puzzleId = parseInt(process.argv[2] ?? '', 10);
  if (isNaN(puzzleId)) {
    console.error('Usage: ts-node scripts/fetch-state.ts <puzzle-id>');
    process.exit(1);
  }

  const state = await fetchMiniGameState(puzzleId, nytS, nytA);
  console.log('\nMini Game State:');
  console.log(JSON.stringify(state, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
