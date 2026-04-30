import { prefetchDate, prefetchRange } from './preloader';
import { fetchWordle, fetchConnections, fetchStrands, fetchMini } from './nytClient';
import { storePuzzle } from './puzzleStore';

jest.mock('./nytClient');
jest.mock('./puzzleStore');

const mockFetchWordle = fetchWordle as jest.Mock;
const mockFetchConnections = fetchConnections as jest.Mock;
const mockFetchStrands = fetchStrands as jest.Mock;
const mockFetchMini = fetchMini as jest.Mock;
const mockStorePuzzle = storePuzzle as jest.Mock;

const wordleData = { id: 1, solution: 'CRANE' };
const connectionsData = { id: 2 };
const strandsData = { id: 3 };
const miniData = { id: 4 };

beforeEach(() => {
  mockFetchWordle.mockReset().mockResolvedValue(wordleData);
  mockFetchConnections.mockReset().mockResolvedValue(connectionsData);
  mockFetchStrands.mockReset().mockResolvedValue(strandsData);
  mockFetchMini.mockReset().mockResolvedValue(miniData);
  mockStorePuzzle.mockReset().mockResolvedValue(undefined);
});

describe('prefetchDate', () => {
  it('fetches all 4 games in parallel and stores them', async () => {
    const result = await prefetchDate('2026-04-29', 'S', 'A');
    expect(result.date).toBe('2026-04-29');
    expect(result.fetched).toEqual(expect.arrayContaining(['wordle', 'connections', 'strands', 'mini']));
    expect(result.failed).toHaveLength(0);
    expect(mockStorePuzzle).toHaveBeenCalledTimes(4);
    expect(mockFetchMini).toHaveBeenCalledWith('2026-04-29', 'S', 'A');
  });

  it('works without auth cookies (mini called without creds)', async () => {
    await prefetchDate('2026-04-29');
    expect(mockFetchMini).toHaveBeenCalledWith('2026-04-29', undefined, undefined);
  });

  it('adds game to failed when fetch throws', async () => {
    mockFetchWordle.mockRejectedValue(new Error('network'));
    const result = await prefetchDate('2026-04-29', 'S', 'A');
    expect(result.failed).toContain('wordle');
    expect(result.fetched).toEqual(expect.arrayContaining(['connections', 'strands', 'mini']));
  });

  it('adds game to failed when storePuzzle throws', async () => {
    mockStorePuzzle.mockRejectedValueOnce(new Error('disk full'));
    const result = await prefetchDate('2026-04-29', 'S', 'A');
    expect(result.failed).toHaveLength(1);
    expect(result.fetched).toHaveLength(3);
  });

  it('all games fail independently', async () => {
    mockFetchWordle.mockRejectedValue(new Error('x'));
    mockFetchConnections.mockRejectedValue(new Error('x'));
    mockFetchStrands.mockRejectedValue(new Error('x'));
    mockFetchMini.mockRejectedValue(new Error('x'));
    const result = await prefetchDate('2026-04-29');
    expect(result.failed).toEqual(expect.arrayContaining(['wordle', 'connections', 'strands', 'mini']));
    expect(result.fetched).toHaveLength(0);
  });
});

describe('prefetchRange', () => {
  it('returns empty array when days is 0', async () => {
    const results = await prefetchRange('2026-04-29', 0);
    expect(results).toHaveLength(0);
  });

  it('fetches correct dates for a 3-day range', async () => {
    const results = await prefetchRange('2026-04-29', 3, 'S', 'A');
    expect(results).toHaveLength(3);
    expect(results[0].date).toBe('2026-04-29');
    expect(results[1].date).toBe('2026-04-30');
    expect(results[2].date).toBe('2026-05-01');
  });

  it('handles month-end overflow correctly', async () => {
    const results = await prefetchRange('2026-01-30', 3, 'S', 'A');
    expect(results[0].date).toBe('2026-01-30');
    expect(results[1].date).toBe('2026-01-31');
    expect(results[2].date).toBe('2026-02-01');
  });
});
