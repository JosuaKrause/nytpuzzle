#!/usr/bin/env ts-node
/**
 * Fetch and display your current NYT game state (Wordle streak, etc.).
 * Usage: ts-node scripts/fetch-state.ts <NYT-S-cookie>
 */
import { fetchGameState } from '../src/services/nytClient';

async function main() {
  const cookie = process.argv[2];
  if (!cookie) {
    console.error('Usage: ts-node scripts/fetch-state.ts <NYT-S-cookie>');
    process.exit(1);
  }

  const state = await fetchGameState(cookie);
  console.log('\nNYT Game State:');
  console.log(JSON.stringify(state, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
