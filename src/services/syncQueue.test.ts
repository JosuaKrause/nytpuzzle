import { flush } from './syncQueue';
import { getPendingCompletions, markSynced, markFailed } from './puzzleStore';
import { postGamesState } from './nytClient';

jest.mock('./puzzleStore');
jest.mock('./nytClient');

const mockGetPending = getPendingCompletions as jest.Mock;
const mockMarkSynced = markSynced as jest.Mock;
const mockMarkFailed = markFailed as jest.Mock;
const mockPost = postGamesState as jest.Mock;

const item1 = { game: 'wordleV2', date: '2026-04-29', puzzleId: '2286', result: { status: 'WIN' } };
const item2 = { game: 'connections', date: '2026-04-29', puzzleId: '1137', result: { puzzleWon: true } };

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
    expect(result).toEqual({ synced: 0, failed: 0 });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('posts each pending item and marks it synced on success', async () => {
    mockGetPending.mockResolvedValue([item1, item2]);
    const result = await flush('S', 'A', 95076669);
    expect(result).toEqual({ synced: 2, failed: 0 });
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(mockMarkSynced).toHaveBeenCalledWith('wordleV2', '2026-04-29');
    expect(mockMarkSynced).toHaveBeenCalledWith('connections', '2026-04-29');
  });

  it('marks item failed when post throws', async () => {
    mockGetPending.mockResolvedValue([item1]);
    mockPost.mockRejectedValue(new Error('network error'));
    const result = await flush('S', undefined, 95076669);
    expect(result).toEqual({ synced: 0, failed: 1 });
    expect(mockMarkFailed).toHaveBeenCalledWith('wordleV2', '2026-04-29');
    expect(mockMarkSynced).not.toHaveBeenCalled();
  });

  it('handles mixed success and failure across items', async () => {
    mockGetPending.mockResolvedValue([item1, item2]);
    mockPost
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('timeout'));
    const result = await flush('S', 'A', 95076669);
    expect(result).toEqual({ synced: 1, failed: 1 });
    expect(mockMarkSynced).toHaveBeenCalledWith('wordleV2', '2026-04-29');
    expect(mockMarkFailed).toHaveBeenCalledWith('connections', '2026-04-29');
  });

  it('includes correct payload fields in post call', async () => {
    mockGetPending.mockResolvedValue([item1]);
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
