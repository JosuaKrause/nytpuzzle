#!/usr/bin/env ts-node
/**
 * Verify that an NYT-S cookie is valid by fetching game state.
 * Usage: ts-node scripts/test-auth.ts <NYT-S-cookie>
 *
 * To get your cookie:
 *   1. Open https://www.nytimes.com/games/wordle in Chrome/Firefox
 *   2. DevTools → Network → any svc/ request → Headers → Cookie
 *   3. Copy the value after "NYT-S="
 */
import { fetchGameState, fetchMini } from '../src/services/nytClient';

async function main() {
  const cookie = process.argv[2];
  if (!cookie) {
    console.error('Usage: ts-node scripts/test-auth.ts <NYT-S-cookie>');
    process.exit(1);
  }

  console.log('\nTesting NYT-S cookie...\n');

  try {
    const state = await fetchGameState(cookie);
    console.log('✓ Game state endpoint (svc/games/state):');
    console.log(JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('✗ Game state endpoint failed:', err);
  }

  console.log();

  try {
    const today = new Date().toISOString().slice(0, 10);
    const mini = await fetchMini(today, cookie);
    console.log(`✓ Mini crossword with auth (${today}):`);
    console.log(`  id=${mini.id}, dimensions=${JSON.stringify(mini.dimensions)}`);
  } catch (err) {
    console.error('✗ Mini crossword with auth failed:', err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
