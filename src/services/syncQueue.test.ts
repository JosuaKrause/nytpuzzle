import { flush } from './syncQueue';
import { getPendingCompletions, markSynced, markFailed } from './puzzleStore';
import { postGamesState } from './nytClient';

jest.mock('./puzzleStore');
jest.mock('./nytClient');

const mockGetPending = getPendingCompletions as jest.Mock;
const mockMarkSynced = markSynced as jest.Mock;
const mockMarkFailed = markFailed as jest.Mock;
const mockPost = postGamesState as jest.Mock;

const wordleItem = { game: 'wordle', date: '2026-04-29', puzzleId: '2286', result: { status: 'WIN' } };
const connectionsItem = { game: 'connections', date: '2026-04-29', puzzleId: '1137', result: { puzzleWon: true } };
const miniItem = { game: 'mini', date: '2026-04-29', puzzleId: '23967', result: { solved: true } };

beforeEach(() => {
  mockGetPending.mockReset();
  mockMarkSynced.mockReset().mockResolvedValue(undefined);
  mockMarkFailed.mockReset().mockResolvedValue(undefined);
  mockPost.mockReset().mockResolvedValue(undefined);
});

describe('flush', () => {
  it('returns zero counts when there are no pending completions', async () => {
    mockGetPending.mockResolvedValue([]);
    const result = await flush('S', 'A', 95076669);
    expect(result).toEqual({ synced: 0, failed: 0, skipped: 0 });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('maps wordle to wordleV2 in the POST payload', async () => {
    mockGetPending.mockResolvedValue([wordleItem]);
    await flush('S', 'A', 95076669);
    const [payload] = mockPost.mock.calls[0];
    expect(payload.game).toBe('wordleV2');
  });

  it('posts each syncable item and marks it synced on success', async () => {
    mockGetPending.mockResolvedValue([wordleItem, connectionsItem]);
    const result = await flush('S', 'A', 95076669);
    expect(result).toEqual({ synced: 2, failed: 0, skipped: 0 });
    expect(mockMarkSynced).toHaveBeenCalledWith('wordle', '2026-04-29');
    expect(mockMarkSynced).toHaveBeenCalledWith('connections', '2026-04-29');
  });

  it('marks item failed when post throws', async () => {
    mockGetPending.mockResolvedValue([wordleItem]);
    mockPost.mockRejectedValue(new Error('network error'));
    const result = await flush('S', undefined, 95076669);
    expect(result).toEqual({ synced: 0, failed: 1, skipped: 0 });
    expect(mockMarkFailed).toHaveBeenCalledWith('wordle', '2026-04-29');
    expect(mockMarkSynced).not.toHaveBeenCalled();
  });

  it('skips mini items (no games/state endpoint for mini)', async () => {
    mockGetPending.mockResolvedValue([miniItem]);
    const result = await flush('S', 'A', 95076669);
    expect(result).toEqual({ synced: 0, failed: 0, skipped: 1 });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('handles mix of success, failure, and skipped', async () => {
    mockGetPending.mockResolvedValue([wordleItem, connectionsItem, miniItem]);
    mockPost
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('timeout'));
    const result = await flush('S', 'A', 95076669);
    expect(result).toEqual({ synced: 1, failed: 1, skipped: 1 });
  });

  it('includes correct payload fields in post call', async () => {
    mockGetPending.mockResolvedValue([wordleItem]);
    await flush('SESS', 'ANON', 12345);
    const [payload, nytS, nytA] = mockPost.mock.calls[0];
    expect(nytS).toBe('SESS');
    expect(nytA).toBe('ANON');
    expect(payload.game).toBe('wordleV2');
    expect(payload.puzzle_id).toBe('2286');
    expect(payload.print_date).toBe('2026-04-29');
    expect(payload.schema_version).toBe('0.45.0');
    expect(payload.user_id).toBe(12345);
    expect(payload.game_data).toEqual({ status: 'WIN' });
  });
});
