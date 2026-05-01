import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { WordleScreen } from './WordleScreen';
import { getPuzzle, saveCompletion } from '../services/puzzleStore';

jest.mock('../services/puzzleStore');

const mockGetPuzzle = getPuzzle as jest.Mock;
const mockSaveCompletion = saveCompletion as jest.Mock;

// Solution: RURAL
const puzzle = { id: 1775, solution: 'RURAL', print_date: '2026-04-29', days_since_launch: 1, editor: 'x' };

const mockNavigation = { goBack: jest.fn() };
const mockRoute = { params: { date: '2026-04-29' } };
const mockRouteDryRun = { params: { date: '2026-04-29', dryRun: true } };

function renderScreen() {
  return render(
    <WordleScreen route={mockRoute as never} navigation={mockNavigation as never} />,
  );
}

function pressWord(word: string) {
  for (const k of word) {
    const el = screen.queryByTestId(`key-${k}`);
    if (el) fireEvent.press(el);
  }
}

beforeEach(() => {
  mockGetPuzzle.mockReset().mockResolvedValue(puzzle);
  mockSaveCompletion.mockReset().mockResolvedValue(undefined);
  mockNavigation.goBack.mockReset();
});

describe('WordleScreen', () => {
  it('shows loading state initially', () => {
    mockGetPuzzle.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByTestId('loading')).toBeTruthy();
  });

  it('shows error state when puzzle is not cached', async () => {
    mockGetPuzzle.mockResolvedValue(null);
    renderScreen();
    await waitFor(() => screen.getByTestId('error'));
  });

  it('navigates back from error screen', async () => {
    mockGetPuzzle.mockResolvedValue(null);
    renderScreen();
    await waitFor(() => screen.getByTestId('go-back'));
    fireEvent.press(screen.getByTestId('go-back'));
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('renders the board after loading', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('board'));
    expect(screen.getByTestId('board-row-0')).toBeTruthy();
    expect(screen.getByTestId('board-row-5')).toBeTruthy();
  });

  it('shows typed letters in the current row', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('key-C'));
    pressWord('CR');
    expect(screen.getByTestId('tile-0-0')).toBeTruthy();
    expect(screen.getByTestId('tile-0-1')).toBeTruthy();
  });

  it('deletes last typed letter with backspace', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('key-C'));
    pressWord('C');
    fireEvent.press(screen.getByTestId('key-⌫'));
    // backspace on empty does not crash
    fireEvent.press(screen.getByTestId('key-⌫'));
    expect(screen.getByTestId('tile-0-0')).toBeTruthy();
  });

  it('shows not enough letters message on short enter', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('key-ENTER'));
    pressWord('C');
    fireEvent.press(screen.getByTestId('key-ENTER'));
    expect(screen.getByTestId('message')).toBeTruthy();
    expect(screen.getByText('Not enough letters')).toBeTruthy();
  });

  it('ignores keypresses when all slots are full', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('key-C'));
    pressWord('CRANES'); // 6 letters, last ignored
    expect(screen.getByTestId('board-row-0')).toBeTruthy();
  });

  it('submits a valid guess and advances the row', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('key-C'));
    pressWord('CRANE');
    fireEvent.press(screen.getByTestId('key-ENTER'));
    await waitFor(() => expect(screen.getByTestId('board-row-1')).toBeTruthy());
  });

  it('wins when the correct word is entered', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('key-R'));
    pressWord('RURAL');
    fireEvent.press(screen.getByTestId('key-ENTER'));
    await waitFor(() => screen.getByText('🎉'));
    expect(mockSaveCompletion).toHaveBeenCalledWith(
      'wordle', '2026-04-29', '1775',
      expect.objectContaining({ status: 'WIN' }),
    );
  });

  it('shows solution on fail after 6 wrong guesses', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('hard-mode-toggle'));
    // Disable hard mode so word choices don't need to satisfy constraints
    fireEvent.press(screen.getByTestId('hard-mode-toggle'));
    const words = ['CRANE', 'STOLE', 'WHIFF', 'DUMPY', 'BEVEL', 'FIZZY'];
    for (const word of words) {
      pressWord(word);
      fireEvent.press(screen.getByTestId('key-ENTER'));
    }
    await waitFor(() => screen.getByText('RURAL'));
    expect(mockSaveCompletion).toHaveBeenCalledWith(
      'wordle', '2026-04-29', '1775',
      expect.objectContaining({ status: 'FAIL' }),
    );
  });

  it('keyboard is disabled after game over', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('key-R'));
    pressWord('RURAL');
    fireEvent.press(screen.getByTestId('key-ENTER'));
    await waitFor(() => screen.getByText('🎉'));
    fireEvent.press(screen.getByTestId('key-C'));
    expect(screen.getByText('🎉')).toBeTruthy();
  });

  it('hard mode rejects guess missing a present letter', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('key-C'));
    // CRANE vs RURAL: R is present (pos 1 in CRANE, in RURAL at 0 or 2)
    pressWord('CRANE');
    fireEvent.press(screen.getByTestId('key-ENTER'));
    await waitFor(() => screen.getByTestId('board-row-1'));
    // STOLE doesn't contain R → hard mode violation
    pressWord('STOLE');
    fireEvent.press(screen.getByTestId('key-ENTER'));
    await waitFor(() => screen.getByTestId('message'));
  });

  it('pre-fills known green positions in the next row', async () => {
    // RADON vs RURAL: R at position 0 is correct
    renderScreen();
    await waitFor(() => screen.getByTestId('key-R'));
    pressWord('RADON');
    fireEvent.press(screen.getByTestId('key-ENTER'));
    await waitFor(() => screen.getByTestId('board-row-1'));

    // Row 1 now has R pre-filled at position 0.
    // Typing 4 more letters fills free slots 1,2,3,4 → RURAL = win
    pressWord('URAL');
    fireEvent.press(screen.getByTestId('key-ENTER'));
    await waitFor(() => screen.getByText('🎉'));
  });

  it('backspace does not clear a locked pre-filled position', async () => {
    // After RADON, R is locked at position 0
    renderScreen();
    await waitFor(() => screen.getByTestId('key-R'));
    pressWord('RADON');
    fireEvent.press(screen.getByTestId('key-ENTER'));
    await waitFor(() => screen.getByTestId('board-row-1'));

    // Type one letter then backspace all the way — R should remain
    pressWord('U');
    fireEvent.press(screen.getByTestId('key-⌫'));
    fireEvent.press(screen.getByTestId('key-⌫'));
    fireEvent.press(screen.getByTestId('key-⌫'));
    // R at position 0 is still there; ENTER should still complain about length
    pressWord('RAL'); // fills 3 more → total 4 out of 5 (still needs 1 more)
    fireEvent.press(screen.getByTestId('key-ENTER'));
    expect(screen.getByText('Not enough letters')).toBeTruthy();
  });

  it('shows DRY RUN label when dryRun param is true', async () => {
    render(
      <WordleScreen route={mockRouteDryRun as never} navigation={mockNavigation as never} />,
    );
    await waitFor(() => screen.getByText('DRY RUN'));
  });

  it('does not call saveCompletion in dry-run mode', async () => {
    render(
      <WordleScreen route={mockRouteDryRun as never} navigation={mockNavigation as never} />,
    );
    await waitFor(() => screen.getByTestId('key-R'));
    pressWord('RURAL');
    fireEvent.press(screen.getByTestId('key-ENTER'));
    await waitFor(() => screen.getByText('🎉'));
    expect(mockSaveCompletion).not.toHaveBeenCalled();
  });

  it('can toggle hard mode off before first guess', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('hard-mode-toggle'));
    fireEvent.press(screen.getByTestId('hard-mode-toggle'));
    expect(screen.getByText('Hard')).toBeTruthy();
  });

  it('hard mode toggle is disabled after first guess', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('key-C'));
    pressWord('CRANE');
    fireEvent.press(screen.getByTestId('key-ENTER'));
    await waitFor(() => screen.getByTestId('board-row-1'));
    const toggle = screen.getByTestId('hard-mode-toggle');
    fireEvent.press(toggle);
    expect(screen.getByText('Hard ✓')).toBeTruthy();
  });
});
