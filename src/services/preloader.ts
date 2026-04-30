import { fetchWordle, fetchConnections, fetchStrands, fetchMini } from './nytClient';
import { storePuzzle } from './puzzleStore';

export interface PrefetchResult {
  date: string;
  fetched: string[];
  failed: string[];
}

export async function prefetchDate(
  date: string,
  nytS?: string,
  nytA?: string,
): Promise<PrefetchResult> {
  const result: PrefetchResult = { date, fetched: [], failed: [] };

  const tasks = [
    { game: 'wordle', fn: (): Promise<unknown> => fetchWordle(date) },
    { game: 'connections', fn: (): Promise<unknown> => fetchConnections(date) },
    { game: 'strands', fn: (): Promise<unknown> => fetchStrands(date) },
    { game: 'mini', fn: (): Promise<unknown> => fetchMini(date, nytS, nytA) },
  ];

  await Promise.all(
    tasks.map(async ({ game, fn }) => {
      try {
        const data = await fn();
        await storePuzzle(game, date, data);
        result.fetched.push(game);
      } catch {
        result.failed.push(game);
      }
    }),
  );

  return result;
}

export async function prefetchRange(
  startDate: string,
  days: number,
  nytS?: string,
  nytA?: string,
): Promise<PrefetchResult[]> {
  const results: PrefetchResult[] = [];
  const start = new Date(startDate + 'T00:00:00Z');

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    results.push(await prefetchDate(d.toISOString().slice(0, 10), nytS, nytA));
  }

  return results;
}
