import {
  fetchWordle,
  fetchConnections,
  fetchStrands,
  fetchMini,
  fetchMiniGameState,
  fetchGamesState,
  postGamesState,
} from './nytClient';
import type { GameStateSyncPayload } from './nytClient';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function mockOk(body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

function mockError(status: number) {
  mockFetch.mockResolvedValueOnce({ ok: false, status });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('fetchWordle', () => {
  it('calls the correct endpoint for a date string', async () => {
    mockOk({ id: 1, solution: 'CRANE', print_date: '2026-04-29', days_since_launch: 1, editor: 'x' });
    const result = await fetchWordle('2026-04-29');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.nytimes.com/svc/wordle/v2/2026-04-29.json',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(result.solution).toBe('CRANE');
  });

  it('formats a Date object to YYYY-MM-DD', async () => {
    mockOk({ id: 2, solution: 'LIGHT', print_date: '2026-04-29', days_since_launch: 2, editor: 'x' });
    await fetchWordle(new Date('2026-04-29'));
    expect(mockFetch.mock.calls[0][0]).toContain('2026-04-29');
  });

  it('throws on non-ok response', async () => {
    mockError(404);
    await expect(fetchWordle('2026-01-01')).rejects.toThrow('NYT API error 404');
  });
});

describe('fetchConnections', () => {
  it('calls the correct endpoint', async () => {
    mockOk({ status: 'OK', id: 1, print_date: '2026-04-29', editor: 'x', categories: [] });
    await fetchConnections('2026-04-29');
    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://www.nytimes.com/svc/connections/v2/2026-04-29.json',
    );
  });

  it('throws on non-ok response', async () => {
    mockError(403);
    await expect(fetchConnections('2026-01-01')).rejects.toThrow('NYT API error 403');
  });
});

describe('fetchStrands', () => {
  it('calls the correct endpoint', async () => {
    mockOk({
      status: 'OK',
      id: 1,
      printDate: '2026-04-29',
      themeWords: [],
      editor: 'x',
      constructors: 'y',
      spangram: 'TACKLE',
      clue: 'test',
      startingBoard: [],
      solutions: [],
      themeCoords: {},
      spangramCoords: [],
    });
    await fetchStrands('2026-04-29');
    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://www.nytimes.com/svc/strands/v2/2026-04-29.json',
    );
  });

  it('throws on non-ok response', async () => {
    mockError(500);
    await expect(fetchStrands('2026-01-01')).rejects.toThrow('NYT API error 500');
  });
});

describe('fetchMini', () => {
  it('sends X-Games-Auth-Bypass header', async () => {
    mockOk({ id: 1, publicationDate: '2026-04-29', constructors: [], copyright: '2026', subcategory: 2, lastUpdated: '', body: [{}] });
    await fetchMini('2026-04-29');
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['X-Games-Auth-Bypass']).toBe('true');
  });

  it('includes cookie when nytS provided', async () => {
    mockOk({ id: 1, publicationDate: '2026-04-29', constructors: [], copyright: '2026', subcategory: 2, lastUpdated: '', body: [{}] });
    await fetchMini('2026-04-29', 'MY_COOKIE');
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['Cookie']).toBe('NYT-S=MY_COOKIE');
  });

  it('includes both cookies when nytS and nytA provided', async () => {
    mockOk({ id: 1, publicationDate: '2026-04-29', constructors: [], copyright: '2026', subcategory: 2, lastUpdated: '', body: [{}] });
    await fetchMini('2026-04-29', 'S_COOKIE', 'A_COOKIE');
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['Cookie']).toBe('NYT-S=S_COOKIE; nyt-a=A_COOKIE');
  });

  it('throws on non-ok response', async () => {
    mockError(401);
    await expect(fetchMini('2026-01-01')).rejects.toThrow('NYT API error 401');
  });
});

describe('fetchMiniGameState', () => {
  it('calls the crossword game endpoint with the puzzle id', async () => {
    mockOk({ puzzleID: 23967, userID: 1, timestamp: 0, lastCommitID: 'abc', board: { cells: [] }, calcs: { percentFilled: 100, secondsSpentSolving: 86, solved: true }, firsts: { opened: 0 } });
    const state = await fetchMiniGameState(23967, 'S_COOKIE', 'A_COOKIE');
    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://www.nytimes.com/svc/crosswords/v6/game/23967.json',
    );
    expect(state.calcs.solved).toBe(true);
  });

  it('sends the NYT-S cookie', async () => {
    mockOk({ puzzleID: 1, userID: 1, timestamp: 0, lastCommitID: '', board: { cells: [] }, calcs: { percentFilled: 0, secondsSpentSolving: 0, solved: false }, firsts: { opened: 0 } });
    await fetchMiniGameState(1, 'MYSESSION');
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['Cookie']).toBe('NYT-S=MYSESSION');
  });

  it('throws on non-ok response', async () => {
    mockError(401);
    await expect(fetchMiniGameState(1, 'BAD')).rejects.toThrow('NYT API error 401');
  });
});

describe('fetchGamesState', () => {
  it('calls the correct endpoint with game and puzzleId', async () => {
    mockOk({ states: [], user_id: 1 });
    await fetchGamesState('wordleV2', '2286', 'S', 'A');
    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://www.nytimes.com/svc/games/state/wordleV2/latests?puzzle_ids=2286',
    );
    expect(mockFetch.mock.calls[0][1].headers['Cookie']).toBe('NYT-S=S; nyt-a=A');
  });

  it('omits nyt-a when not provided', async () => {
    mockOk({ states: [], user_id: 1 });
    await fetchGamesState('connections', '1137', 'S');
    expect(mockFetch.mock.calls[0][1].headers['Cookie']).toBe('NYT-S=S');
  });

  it('throws on non-ok response', async () => {
    mockError(401);
    await expect(fetchGamesState('strands', '960', 'BAD')).rejects.toThrow('NYT API error 401');
  });
});

describe('postGamesState', () => {
  const payload: GameStateSyncPayload = {
    game: 'wordleV2',
    game_data: {
      boardState: ['crane'],
      currentRowIndex: 1,
      hardMode: false,
      isPlayingArchive: false,
      status: 'IN_PROGRESS',
    },
    puzzle_id: '2286',
    print_date: '2026-04-29',
    schema_version: '0.45.0',
    timestamp: 1777500000,
    user_id: 95076669,
  };

  it('POSTs to svc/games/state with cookie and JSON body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 201 });
    await postGamesState(payload, 'S', 'A');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://www.nytimes.com/svc/games/state');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['Cookie']).toBe('NYT-S=S; nyt-a=A');
    expect(JSON.parse(init.body as string).game).toBe('wordleV2');
  });

  it('omits nyt-a cookie when not provided', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 201 });
    await postGamesState(payload, 'S');
    expect(mockFetch.mock.calls[0][1].headers['Cookie']).toBe('NYT-S=S');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(postGamesState(payload, 'BAD')).rejects.toThrow('NYT API error 500');
  });
});
