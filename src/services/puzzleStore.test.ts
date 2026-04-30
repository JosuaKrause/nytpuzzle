import * as SQLite from 'expo-sqlite';
import {
  initDb,
  storePuzzle,
  getPuzzle,
  saveCompletion,
  getPendingCompletions,
  markSynced,
  markFailed,
} from './puzzleStore';

jest.mock('expo-sqlite');

const mockDb = {
  execAsync: jest.fn<Promise<void>, [string]>(),
  runAsync: jest.fn<Promise<{ lastInsertRowId: number; changes: number }>, [string, unknown[]]>(),
  getFirstAsync: jest.fn<Promise<unknown>, [string, unknown[]]>(),
  getAllAsync: jest.fn<Promise<unknown[]>, [string]>(),
};

beforeAll(() => {
  (SQLite.openDatabaseSync as jest.Mock).mockReturnValue(mockDb);
});

beforeEach(() => {
  mockDb.execAsync.mockReset().mockResolvedValue(undefined);
  mockDb.runAsync.mockReset().mockResolvedValue({ lastInsertRowId: 0, changes: 1 });
  mockDb.getFirstAsync.mockReset().mockResolvedValue(null);
  mockDb.getAllAsync.mockReset().mockResolvedValue([]);
});

describe('initDb', () => {
  it('executes CREATE TABLE statements', async () => {
    await initDb();
    expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS puzzles'));
    expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS completions'));
  });
});

describe('storePuzzle', () => {
  it('inserts puzzle data as JSON with current timestamp', async () => {
    const data = { id: 1, solution: 'CRANE' };
    await storePuzzle('wordle', '2026-04-29', data);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO puzzles'),
      expect.arrayContaining(['wordle', '2026-04-29', JSON.stringify(data)]),
    );
  });
});

describe('getPuzzle', () => {
  it('returns parsed data when row exists', async () => {
    const data = { id: 1, solution: 'CRANE' };
    mockDb.getFirstAsync.mockResolvedValue({ data: JSON.stringify(data) });
    const result = await getPuzzle<typeof data>('wordle', '2026-04-29');
    expect(result).toEqual(data);
  });

  it('returns null when row does not exist', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);
    const result = await getPuzzle('wordle', '2026-04-29');
    expect(result).toBeNull();
  });
});

describe('saveCompletion', () => {
  it('inserts completion with pending status', async () => {
    const result = { status: 'WIN' };
    await saveCompletion('wordleV2', '2026-04-29', '2286', result);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO completions'),
      expect.arrayContaining(['wordleV2', '2026-04-29', '2286', JSON.stringify(result)]),
    );
  });
});

describe('getPendingCompletions', () => {
  it('returns mapped completions with parsed result', async () => {
    const resultData = { status: 'WIN' };
    mockDb.getAllAsync.mockResolvedValue([
      { game: 'wordleV2', date: '2026-04-29', puzzle_id: '2286', result: JSON.stringify(resultData) },
    ]);
    const items = await getPendingCompletions();
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      game: 'wordleV2',
      date: '2026-04-29',
      puzzleId: '2286',
      result: resultData,
    });
  });

  it('returns empty array when no pending completions', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    const items = await getPendingCompletions();
    expect(items).toHaveLength(0);
  });
});

describe('markSynced', () => {
  it('updates sync_status to synced', async () => {
    await markSynced('wordleV2', '2026-04-29');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("sync_status = 'synced'"),
      expect.arrayContaining(['wordleV2', '2026-04-29']),
    );
  });
});

describe('markFailed', () => {
  it('updates sync_status to failed', async () => {
    await markFailed('wordleV2', '2026-04-29');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("sync_status = 'failed'"),
      expect.arrayContaining(['wordleV2', '2026-04-29']),
    );
  });
});
