import { computeRowColors, buildKeyboardColors, validateHardMode, computeLockedPositions } from './wordle';

describe('computeRowColors', () => {
  it('marks all correct when guess equals solution', () => {
    expect(computeRowColors('crane', 'CRANE')).toEqual(
      ['correct', 'correct', 'correct', 'correct', 'correct'],
    );
  });

  it('marks absent when no letters match', () => {
    expect(computeRowColors('zzzzz', 'CRANE')).toEqual(
      ['absent', 'absent', 'absent', 'absent', 'absent'],
    );
  });

  it('marks present for correct letter in wrong position', () => {
    const colors = computeRowColors('aeons', 'CRANE');
    expect(colors[0]).toBe('present'); // A in CRANE (pos 2), wrong pos
    expect(colors[1]).toBe('present'); // E in CRANE (pos 4), wrong pos
    expect(colors[2]).toBe('absent');  // O not in CRANE
    expect(colors[3]).toBe('correct'); // N at pos 3 in both
    expect(colors[4]).toBe('absent');  // S not in CRANE
  });

  it('does not double-count duplicate letters', () => {
    const colors = computeRowColors('aabbb', 'aaccc');
    expect(colors[0]).toBe('correct');
    expect(colors[1]).toBe('correct');
    expect(colors[2]).toBe('absent');
    expect(colors[3]).toBe('absent');
    expect(colors[4]).toBe('absent');
  });

  it('handles duplicate letters in guess without over-counting', () => {
    const colors = computeRowColors('speed', 'creep');
    expect(colors[0]).toBe('absent');  // s not in creep
    expect(colors[4]).toBe('absent');  // d not in creep
  });

  it('is case-insensitive', () => {
    expect(computeRowColors('CRANE', 'crane')).toEqual(
      ['correct', 'correct', 'correct', 'correct', 'correct'],
    );
  });
});

describe('buildKeyboardColors', () => {
  it('returns empty map for empty boardState', () => {
    expect(buildKeyboardColors(['', '', '', '', '', ''], 'CRANE')).toEqual({});
  });

  it('maps letters to their best color across guesses', () => {
    const map = buildKeyboardColors(['crane', '', '', '', '', ''], 'CRANE');
    expect(map['C']).toBe('correct');
    expect(map['R']).toBe('correct');
  });

  it('upgrades letter color when a better result is found', () => {
    const map = buildKeyboardColors(['trace', 'crane', '', '', '', ''], 'CRANE');
    expect(map['A']).toBe('correct');
  });

  it('does not downgrade a correct letter to present', () => {
    const map = buildKeyboardColors(['crane', 'crimp', '', '', '', ''], 'CRANE');
    expect(map['C']).toBe('correct');
  });
});

describe('validateHardMode', () => {
  it('returns null when all constraints are satisfied', () => {
    const colors = [['correct', 'absent', 'absent', 'absent', 'absent']] as Parameters<typeof validateHardMode>[2];
    expect(validateHardMode('crane', ['clamp'], colors)).toBeNull();
  });

  it('returns error when a correct position is not reused', () => {
    const colors = [['correct', 'absent', 'absent', 'absent', 'absent']] as Parameters<typeof validateHardMode>[2];
    const error = validateHardMode('abcde', ['clamp'], colors);
    expect(error).toContain('Position 1');
    expect(error).toContain('C');
  });

  it('returns error when a present letter is omitted', () => {
    const colors = [['absent', 'present', 'absent', 'absent', 'absent']] as Parameters<typeof validateHardMode>[2];
    const error = validateHardMode('crane', ['clamp'], colors);
    expect(error).toContain('L');
  });

  it('returns null for empty board (no prior guesses)', () => {
    expect(validateHardMode('crane', ['', '', '', '', '', ''], [])).toBeNull();
  });
});

describe('computeLockedPositions', () => {
  it('returns all null when no guesses submitted', () => {
    expect(computeLockedPositions([], [])).toEqual([null, null, null, null, null]);
  });

  it('locks positions that were marked correct', () => {
    const boardState = ['radon'];
    const tileColors = [['correct', 'absent', 'absent', 'absent', 'absent']];
    const locked = computeLockedPositions(boardState, tileColors);
    expect(locked[0]).toBe('R');
    expect(locked[1]).toBeNull();
    expect(locked[2]).toBeNull();
  });

  it('accumulates greens across multiple rows', () => {
    const boardState = ['radon', 'rural'];
    const tileColors = [
      ['correct', 'absent', 'absent', 'absent', 'absent'],
      ['correct', 'correct', 'correct', 'correct', 'correct'],
    ];
    const locked = computeLockedPositions(boardState, tileColors);
    expect(locked).toEqual(['R', 'U', 'R', 'A', 'L']);
  });

  it('later row overrides earlier row for same position', () => {
    const boardState = ['abbey', 'afoot'];
    const tileColors = [
      ['correct', 'absent', 'absent', 'absent', 'absent'],
      ['correct', 'absent', 'absent', 'absent', 'absent'],
    ];
    const locked = computeLockedPositions(boardState, tileColors);
    expect(locked[0]).toBe('A');
  });
});
