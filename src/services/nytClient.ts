export type GameType = 'wordle' | 'connections' | 'strands' | 'mini';

// --- Wordle ---
export interface WordlePuzzle {
  id: number;
  solution: string;
  print_date: string;
  days_since_launch: number;
  editor: string;
}

// --- Connections ---
export interface ConnectionsCard {
  position: number;
  content?: string;       // text puzzles
  image_url?: string;     // image puzzles
  image_alt_text?: string;
}

export interface ConnectionsCategory {
  title: string;
  cards: ConnectionsCard[];
}

export interface ConnectionsPuzzle {
  status: string;
  id: number;
  print_date: string;
  editor: string;
  illustrator?: string;
  categories: ConnectionsCategory[];
}

// --- Strands (all camelCase from the API) ---
export interface StrandsPuzzle {
  status: string;
  id: number;
  printDate: string;
  themeWords: string[];
  editor: string;
  constructors: string;
  spangram: string;
  clue: string;
  startingBoard: string[];
  solutions: string[];
  themeCoords: Record<string, [number, number][]>;
  spangramCoords: [number, number][];
}

// --- Mini crossword ---
export interface MiniCell {
  blank?: true;
  answer?: string;
  clues?: number[];
  label?: string;
  type?: number;
}

export interface MiniClueText {
  plain: string;
}

export interface MiniClue {
  cells: number[];
  direction: 'Across' | 'Down';
  label: string;
  list?: number;
  relatives?: number[];
  text: MiniClueText[];
}

export interface MiniClueList {
  clues: number[];
  name: string;
}

export interface MiniBody {
  cells: MiniCell[];
  clueLists: MiniClueList[];
  clues: MiniClue[];
  dimensions: { height: number; width: number };
  board: string;
}

export interface MiniPuzzle {
  id: number;
  publicationDate: string;
  constructors: string[];
  copyright: string;
  subcategory: number;
  lastUpdated: string;
  body: [MiniBody];
}

// --- Mini game state (svc/crosswords/v6/game/{id}) ---
export interface MiniGameCell {
  blank?: true;
  guess?: string;
  timestamp?: number;
}

export interface MiniGameState {
  puzzleID: number;
  userID: number;
  timestamp: number;
  lastCommitID: string;
  board: { cells: MiniGameCell[] };
  calcs: {
    percentFilled: number;
    secondsSpentSolving: number;
    solved: boolean;
  };
  firsts: { opened: number; solved?: number };
  minGuessTime?: number;
  lastSolve?: number;
}

// --- Games state API ---

export type GamesStateName = 'wordleV2' | 'connections' | 'strands';

export interface WordleGameData {
  boardState: string[];
  currentRowIndex: number;
  hardMode: boolean;
  isPlayingArchive: boolean;
  status: 'IN_PROGRESS' | 'WIN' | 'FAIL';
}

export interface ConnectionsStateCard {
  position: number;
  level: number;
}

export interface ConnectionsGuess {
  cards: ConnectionsStateCard[];
  correct: boolean;
}

export interface ConnectionsSolvedCategory {
  cards: ConnectionsStateCard[];
  level: number;
  orderSolved: number;
}

export interface ConnectionsGameData {
  puzzleComplete: boolean;
  puzzleWon: boolean;
  mistakes: number;
  guesses: ConnectionsGuess[];
  solvedCategories: ConnectionsSolvedCategory[];
  isPlayingArchive: boolean;
}

export interface StrandsHistoryEntry {
  t: 'THEME' | 'SPANGRAM' | 'HINT';
  w: string;
}

export interface StrandsGameData {
  history: StrandsHistoryEntry[];
  isPlayingArchive: boolean;
  isSolved: boolean;
  otherWordsFound: string[];
}

export type AnyGameData = WordleGameData | ConnectionsGameData | StrandsGameData;

export interface GamesStateRecord {
  game_data: AnyGameData;
  puzzle_id: string;
  game: GamesStateName;
  user_id: number;
  version: string;
  timestamp: number;
  print_date: string;
  schema_version: string;
}

export interface GamesStateResponse {
  states: GamesStateRecord[];
  user_id: number;
}

export interface GameStateSyncPayload {
  game: GamesStateName;
  game_data: AnyGameData;
  puzzle_id: string;
  print_date: string;
  schema_version: string;
  timestamp: number;
  user_id: number;
}

const BASE = 'https://www.nytimes.com';

function dateParam(date: Date | string): string {
  if (typeof date === 'string') return date;
  return date.toISOString().slice(0, 10);
}

async function nytFetch<T>(url: string, cookie?: string, extraHeaders?: Record<string, string>): Promise<T> {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (compatible; nytpuzzle/1.0)',
    ...extraHeaders,
  };
  if (cookie) {
    headers['Cookie'] = cookie;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`NYT API error ${res.status} for ${url}`);
  }
  return res.json() as Promise<T>;
}

async function nytPost(url: string, body: unknown, cookie: string): Promise<void> {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (compatible; nytpuzzle/1.0)',
    'Content-Type': 'application/json',
    'Cookie': cookie,
  };
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`NYT API error ${res.status} for ${url}`);
}

function cookieHeader(nytS: string, nytA?: string): string {
  return nytA ? `NYT-S=${nytS}; nyt-a=${nytA}` : `NYT-S=${nytS}`;
}

export async function fetchWordle(date: Date | string): Promise<WordlePuzzle> {
  return nytFetch<WordlePuzzle>(`${BASE}/svc/wordle/v2/${dateParam(date)}.json`);
}

export async function fetchConnections(date: Date | string): Promise<ConnectionsPuzzle> {
  return nytFetch<ConnectionsPuzzle>(`${BASE}/svc/connections/v2/${dateParam(date)}.json`);
}

export async function fetchStrands(date: Date | string): Promise<StrandsPuzzle> {
  return nytFetch<StrandsPuzzle>(`${BASE}/svc/strands/v2/${dateParam(date)}.json`);
}

export async function fetchMini(date: Date | string, nytS?: string, nytA?: string): Promise<MiniPuzzle> {
  const cookie = nytS ? cookieHeader(nytS, nytA) : undefined;
  return nytFetch<MiniPuzzle>(
    `${BASE}/svc/crosswords/v6/puzzle/mini/${dateParam(date)}.json`,
    cookie,
    { 'X-Games-Auth-Bypass': 'true' },
  );
}

export async function fetchMiniGameState(puzzleId: number, nytS: string, nytA?: string): Promise<MiniGameState> {
  return nytFetch<MiniGameState>(
    `${BASE}/svc/crosswords/v6/game/${puzzleId}.json`,
    cookieHeader(nytS, nytA),
  );
}

export async function fetchGamesState(
  game: GamesStateName,
  puzzleId: string,
  nytS: string,
  nytA?: string,
): Promise<GamesStateResponse> {
  return nytFetch<GamesStateResponse>(
    `${BASE}/svc/games/state/${game}/latests?puzzle_ids=${puzzleId}`,
    cookieHeader(nytS, nytA),
  );
}

export async function postGamesState(
  payload: GameStateSyncPayload,
  nytS: string,
  nytA?: string,
): Promise<void> {
  await nytPost(`${BASE}/svc/games/state`, payload, cookieHeader(nytS, nytA));
}
