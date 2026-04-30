export type GameType = 'wordle' | 'connections' | 'strands' | 'mini';

export interface WordlePuzzle {
  id: number;
  solution: string;
  print_date: string;
  days_since_launch: number;
  editor: string;
}

export interface ConnectionsCategory {
  title: string;
  cards: Array<{ content: string; position: number }>;
  difficulty: number;
}

export interface ConnectionsPuzzle {
  id: number;
  print_date: string;
  categories: ConnectionsCategory[];
}

export interface StrandsPuzzle {
  id: number;
  print_date: string;
  spangram: string;
  theme_words: string[];
  clue: string;
  starting_board: string[][];
}

export interface MiniClue {
  text: string;
  direction: 'Across' | 'Down';
  label: number;
  cells: number[];
}

export interface MiniPuzzle {
  id: number;
  print_date: string;
  clues: MiniClue[];
  cells: Array<{ answer: string; type: number }>;
  dimensions: { rows: number; cols: number };
}

export interface NytGameState {
  wordle?: unknown;
  spelling_bee?: unknown;
}

const BASE = 'https://www.nytimes.com';

function dateParam(date: Date | string): string {
  if (typeof date === 'string') return date;
  return date.toISOString().slice(0, 10);
}

async function nytFetch<T>(url: string, cookie?: string): Promise<T> {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (compatible; nytpuzzle/1.0)',
  };
  if (cookie) {
    headers['Cookie'] = `NYT-S=${cookie}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`NYT API error ${res.status} for ${url}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchWordle(date: Date | string): Promise<WordlePuzzle> {
  const d = dateParam(date);
  return nytFetch<WordlePuzzle>(`${BASE}/svc/wordle/v2/${d}.json`);
}

export async function fetchConnections(date: Date | string): Promise<ConnectionsPuzzle> {
  const d = dateParam(date);
  return nytFetch<ConnectionsPuzzle>(`${BASE}/svc/connections/v2/${d}.json`);
}

export async function fetchStrands(date: Date | string): Promise<StrandsPuzzle> {
  const d = dateParam(date);
  return nytFetch<StrandsPuzzle>(`${BASE}/svc/strands/v2/${d}.json`);
}

export async function fetchMini(date: Date | string, cookie?: string): Promise<MiniPuzzle> {
  const d = dateParam(date);
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (compatible; nytpuzzle/1.0)',
    'X-Games-Auth-Bypass': 'true',
  };
  if (cookie) {
    headers['Cookie'] = `NYT-S=${cookie}`;
  }
  const res = await fetch(`${BASE}/svc/crosswords/v6/puzzle/mini/${d}.json`, { headers });
  if (!res.ok) {
    throw new Error(`NYT API error ${res.status} for mini ${d}`);
  }
  return res.json() as Promise<MiniPuzzle>;
}

export async function fetchGameState(cookie: string): Promise<NytGameState> {
  return nytFetch<NytGameState>(`${BASE}/svc/games/state`, cookie);
}
