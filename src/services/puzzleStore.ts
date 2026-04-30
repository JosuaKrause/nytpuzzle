import * as SQLite from 'expo-sqlite';

export type SyncStatus = 'pending' | 'synced' | 'failed';

export interface PendingCompletion {
  game: string;
  date: string;
  puzzleId: string;
  result: unknown;
}

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('nytpuzzles.db');
  }
  return db;
}

export async function initDb(): Promise<void> {
  await getDb().execAsync(`
    CREATE TABLE IF NOT EXISTS puzzles (
      game TEXT NOT NULL,
      date TEXT NOT NULL,
      data TEXT NOT NULL,
      fetched_at INTEGER NOT NULL,
      PRIMARY KEY (game, date)
    );
    CREATE TABLE IF NOT EXISTS completions (
      game TEXT NOT NULL,
      date TEXT NOT NULL,
      puzzle_id TEXT NOT NULL,
      result TEXT NOT NULL,
      completed_at INTEGER NOT NULL,
      synced_at INTEGER,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      PRIMARY KEY (game, date)
    );
  `);
}

export async function storePuzzle(game: string, date: string, data: unknown): Promise<void> {
  await getDb().runAsync(
    'INSERT OR REPLACE INTO puzzles (game, date, data, fetched_at) VALUES (?, ?, ?, ?)',
    [game, date, JSON.stringify(data), Date.now()],
  );
}

export async function getPuzzle<T>(game: string, date: string): Promise<T | null> {
  const row = await getDb().getFirstAsync<{ data: string }>(
    'SELECT data FROM puzzles WHERE game = ? AND date = ?',
    [game, date],
  );
  return row ? (JSON.parse(row.data) as T) : null;
}

export async function saveCompletion(
  game: string,
  date: string,
  puzzleId: string,
  result: unknown,
): Promise<void> {
  await getDb().runAsync(
    `INSERT OR REPLACE INTO completions
       (game, date, puzzle_id, result, completed_at, sync_status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [game, date, puzzleId, JSON.stringify(result), Date.now()],
  );
}

export async function getPendingCompletions(): Promise<PendingCompletion[]> {
  const rows = await getDb().getAllAsync<{
    game: string;
    date: string;
    puzzle_id: string;
    result: string;
  }>(
    `SELECT game, date, puzzle_id, result FROM completions
     WHERE sync_status = 'pending' OR sync_status = 'failed'`,
  );
  return rows.map(r => ({
    game: r.game,
    date: r.date,
    puzzleId: r.puzzle_id,
    result: JSON.parse(r.result) as unknown,
  }));
}

export async function markSynced(game: string, date: string): Promise<void> {
  await getDb().runAsync(
    `UPDATE completions SET sync_status = 'synced', synced_at = ? WHERE game = ? AND date = ?`,
    [Date.now(), game, date],
  );
}

export async function markFailed(game: string, date: string): Promise<void> {
  await getDb().runAsync(
    `UPDATE completions SET sync_status = 'failed' WHERE game = ? AND date = ?`,
    [game, date],
  );
}
