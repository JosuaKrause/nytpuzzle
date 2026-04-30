#!/usr/bin/env ts-node
/**
 * Verify auth by fetching Mini game state.
 * Usage: ts-node scripts/test-auth.ts [YYYY-MM-DD]
 *
 * Reads NYT_S and NYT_A from .env. Get them from DevTools:
 *   1. Open https://www.nytimes.com/games/wordle in Chrome
 *   2. DevTools → Network → any svc/ request → Headers → Cookie
 *   3. Copy NYT-S=... and nyt-a=... values into .env
 */
import 'dotenv/config';
import { fetchMini, fetchMiniGameState } from '../src/services/nytClient';

async function main() {
  const nytS = process.env.NYT_S;
  const nytA = process.env.NYT_A;

  if (!nytS) {
    console.error('NYT_S not set in .env');
    process.exit(1);
  }

  const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  console.log(`\nTesting auth for ${date}...\n`);

  try {
    const mini = await fetchMini(date, nytS, nytA);
    console.log(`✓ Mini puzzle fetched: id=${mini.id}, constructor=${mini.constructors.join(', ')}`);

    const state = await fetchMiniGameState(mini.id, nytS, nytA);
    console.log(`✓ Mini game state: solved=${state.calcs.solved}, filled=${state.calcs.percentFilled}%`);
    if (state.calcs.solved) {
      const secs = state.calcs.secondsSpentSolving;
      console.log(`  Solved in ${secs}s (${Math.round(secs / 60)}m${secs % 60}s)`);
    }
  } catch (err) {
    console.error('✗ Auth test failed:', err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
