import { fetchWordle, fetchConnections, fetchStrands, fetchMini, fetchGameState } from './nytClient';

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
    mockOk({ id: 1, print_date: '2026-04-29', categories: [] });
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
    mockOk({ id: 1, print_date: '2026-04-29', spangram: 'HELLO', theme_words: [], clue: 'test', starting_board: [] });
    await fetchStrands('2026-04-29');
    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://www.nytimes.com/svc/strands/v2/2026-04-29.json',
    );
  });
});

describe('fetchMini', () => {
  it('sends X-Games-Auth-Bypass header', async () => {
    mockOk({ id: 1, print_date: '2026-04-29', clues: [], cells: [], dimensions: { rows: 5, cols: 5 } });
    await fetchMini('2026-04-29');
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['X-Games-Auth-Bypass']).toBe('true');
  });

  it('includes cookie when provided', async () => {
    mockOk({ id: 1, print_date: '2026-04-29', clues: [], cells: [], dimensions: { rows: 5, cols: 5 } });
    await fetchMini('2026-04-29', 'MY_COOKIE');
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['Cookie']).toBe('NYT-S=MY_COOKIE');
  });

  it('throws on non-ok response', async () => {
    mockError(401);
    await expect(fetchMini('2026-01-01')).rejects.toThrow('NYT API error 401');
  });
});

describe('fetchGameState', () => {
  it('sends the NYT-S cookie', async () => {
    mockOk({ wordle: {}, spelling_bee: {} });
    await fetchGameState('MYSESSION');
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['Cookie']).toBe('NYT-S=MYSESSION');
  });
});
