import { getPendingCompletions, markSynced, markFailed } from './puzzleStore';
import { postGamesState, GamesStateName, AnyGameData } from './nytClient';

// Maps our internal game names to the NYT state API game names.
// 'mini' is excluded: it syncs via the crossword endpoint, not games/state.
const STATE_GAME: Record<string, GamesStateName | undefined> = {
  wordle: 'wordleV2',
  connections: 'connections',
  strands: 'strands',
};

export interface FlushResult {
  synced: number;
  failed: number;
  skipped: number;
}

export async function flush(
  nytS: string,
  nytA: string | undefined,
  userId: number,
): Promise<FlushResult> {
  const pending = await getPendingCompletions();
  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of pending) {
    const stateGame = STATE_GAME[item.game];
    if (!stateGame) {
      skipped++;
      continue;
    }
    try {
      await postGamesState(
        {
          game: stateGame,
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

  return { synced, failed, skipped };
}
