#!/usr/bin/env ts-node
/**
 * Fetch and pretty-print puzzle data for all 4 NYT games on a given date.
 * Usage: ts-node scripts/fetch-puzzle.ts [YYYY-MM-DD] [NYT-S-cookie]
 *
 * The date defaults to today. The cookie is optional (needed for Mini).
 */
import { fetchWordle, fetchConnections, fetchStrands, fetchMini } from '../src/services/nytClient';

async function main() {
  const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  const cookie = process.argv[3];

  console.log(`\nFetching puzzles for ${date}...\n`);

  const results = await Promise.allSettled([
    fetchWordle(date).then((d) => ({ game: 'Wordle', data: d })),
    fetchConnections(date).then((d) => ({ game: 'Connections', data: d })),
    fetchStrands(date).then((d) => ({ game: 'Strands', data: d })),
    fetchMini(date, cookie).then((d) => ({ game: 'Mini', data: d })),
  ]);

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { game, data } = result.value;
      console.log(`=== ${game} ===`);
      console.log(JSON.stringify(data, null, 2));
      console.log();
    } else {
      console.error(`FAILED: ${result.reason}`);
      console.log();
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
