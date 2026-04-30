import { getPendingCompletions, markSynced, markFailed } from './puzzleStore';
import { postGamesState, GamesStateName, AnyGameData } from './nytClient';

export interface FlushResult {
  synced: number;
  failed: number;
}

export async function flush(
  nytS: string,
  nytA: string | undefined,
  userId: number,
): Promise<FlushResult> {
  const pending = await getPendingCompletions();
  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      await postGamesState(
        {
          game: item.game as GamesStateName,
          game_data: item.result as AnyGameData,
          puzzle_id: item.puzzleId,
          print_date: item.date,
          schema_version: '0.45.0',
          timestamp: Math.floor(Date.now() / 1000),
          user_id: userId,
        },
        nytS,
        nytA,
      );
      await markSynced(item.game, item.date);
      synced++;
    } catch {
      await markFailed(item.game, item.date);
      failed++;
    }
  }

  return { synced, failed };
}
