export type TileState = 'correct' | 'present' | 'absent' | 'pending' | 'empty';

export function computeRowColors(guess: string, solution: string): TileState[] {
  const result: TileState[] = Array(5).fill('absent');
  const sol = solution.toUpperCase().split('');
  const g = guess.toUpperCase().split('');
  const solUsed = Array(5).fill(false);
  const guessUsed = Array(5).fill(false);

  for (let i = 0; i < 5; i++) {
    if (g[i] === sol[i]) {
      result[i] = 'correct';
      solUsed[i] = true;
      guessUsed[i] = true;
    }
  }

  for (let i = 0; i < 5; i++) {
    if (guessUsed[i]) continue;
    for (let j = 0; j < 5; j++) {
      if (!solUsed[j] && g[i] === sol[j]) {
        result[i] = 'present';
        solUsed[j] = true;
        break;
      }
    }
  }

  return result;
}

const COLOR_RANK: Record<TileState, number> = {
  correct: 3,
  present: 2,
  absent: 1,
  pending: 0,
  empty: 0,
};

export function buildKeyboardColors(
  boardState: string[],
  solution: string,
): Record<string, TileState> {
  const map: Record<string, TileState> = {};
  for (const guess of boardState) {
    if (!guess) continue;
    const colors = computeRowColors(guess, solution);
    guess.toUpperCase().split('').forEach((letter, i) => {
      const current = map[letter];
      if (!current || COLOR_RANK[colors[i]] > COLOR_RANK[current]) {
        map[letter] = colors[i];
      }
    });
  }
  return map;
}

export function validateHardMode(
  guess: string,
  boardState: string[],
  allColors: TileState[][],
): string | null {
  for (let row = 0; row < allColors.length; row++) {
    const prev = boardState[row].toUpperCase();
    const colors = allColors[row];
    for (let i = 0; i < 5; i++) {
      if (colors[i] === 'correct' && guess[i]?.toUpperCase() !== prev[i]) {
        return `Position ${i + 1} must be ${prev[i]}`;
      }
    }
    for (let i = 0; i < 5; i++) {
      if (colors[i] === 'present' && !guess.toUpperCase().includes(prev[i])) {
        return `Guess must contain ${prev[i]}`;
      }
    }
  }
  return null;
}

// Returns a 5-element array: null = free slot, string = locked green letter.
// Used to pre-fill the next row in hard mode.
export function computeLockedPositions(
  boardState: string[],
  tileColors: TileState[][],
): (string | null)[] {
  const locked: (string | null)[] = Array(5).fill(null);
  for (let row = 0; row < tileColors.length; row++) {
    const guess = boardState[row].toUpperCase();
    for (let col = 0; col < 5; col++) {
      if (tileColors[row][col] === 'correct') {
        locked[col] = guess[col];
      }
    }
  }
  return locked;
}
