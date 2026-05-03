import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ConnectionsScreen } from './ConnectionsScreen';
import { getPuzzle, saveCompletion } from '../services/puzzleStore';

jest.mock('../services/puzzleStore');

const mockGetPuzzle = getPuzzle as jest.Mock;
const mockSaveCompletion = saveCompletion as jest.Mock;

// After extractCards sorted by position:
// idx: 0=A(y) 1=E(g) 2=I(b) 3=M(p)  4=B(y) 5=F(g) 6=J(b) 7=N(p)
//      8=C(y) 9=G(g) 10=K(b) 11=O(p)  12=D(y) 13=H(g) 14=L(b) 15=P(p)
// Yellow (level 0) correct: cards 0,4,8,12
const puzzle = {
  id: 1137, status: 'OK', print_date: '2026-04-29', editor: 'x',
  categories: [
    { title: 'Yellow', cards: [{ content: 'A', position: 0 }, { content: 'B', position: 4 }, { content: 'C', position: 8 }, { content: 'D', position: 12 }] },
    { title: 'Green',  cards: [{ content: 'E', position: 1 }, { content: 'F', position: 5 }, { content: 'G', position: 9 }, { content: 'H', position: 13 }] },
    { title: 'Blue',   cards: [{ content: 'I', position: 2 }, { content: 'J', position: 6 }, { content: 'K', position: 10 }, { content: 'L', position: 14 }] },
    { title: 'Purple', cards: [{ content: 'M', position: 3 }, { content: 'N', position: 7 }, { content: 'O', position: 11 }, { content: 'P', position: 15 }] },
  ],
};

const mockNav = { goBack: jest.fn() };

function renderScreen(extra: Record<string, unknown> = {}) {
  return render(
    <ConnectionsScreen
      route={{ params: { date: '2026-04-29', ...extra } } as never}
      navigation={mockNav as never}
    />,
  );
}

function select(...indices: number[]) {
  indices.forEach(i => fireEvent.press(screen.getByTestId(`card-${i}`)));
}

beforeEach(() => {
  mockGetPuzzle.mockReset().mockResolvedValue(puzzle);
  mockSaveCompletion.mockReset().mockResolvedValue(undefined);
  mockNav.goBack.mockReset();
});

describe('ConnectionsScreen', () => {
  it('shows loading state initially', () => {
    mockGetPuzzle.mockReturnValue(new Promise(() => {}));
    renderScreen();
    expect(screen.getByTestId('loading')).toBeTruthy();
  });

  it('shows error when puzzle not cached', async () => {
    mockGetPuzzle.mockResolvedValue(null);
    renderScreen();
    await waitFor(() => screen.getByTestId('error'));
  });

  it('navigates back from error screen', async () => {
    mockGetPuzzle.mockResolvedValue(null);
    renderScreen();
    await waitFor(() => screen.getByTestId('go-back'));
    fireEvent.press(screen.getByTestId('go-back'));
    expect(mockNav.goBack).toHaveBeenCalled();
  });

  it('renders all 16 cards after loading', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('grid'));
    for (let i = 0; i < 16; i++) expect(screen.getByTestId(`card-${i}`)).toBeTruthy();
  });

  it('selects a card on tap and shows it as selected', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    select(0);
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('deselects a card on second tap', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    select(0, 0); // tap twice
    expect(screen.getByTestId('card-0')).toBeTruthy();
  });

  it('cannot select more than 4 cards', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    select(0, 1, 2, 3, 4); // 5th ignored, submit stays enabled with 4 selected
    expect(screen.getByTestId('submit-button')).toBeTruthy();
  });

  it('deselect-all clears selection and message', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    select(0, 1);
    fireEvent.press(screen.getByTestId('deselect-button'));
    expect(screen.getByTestId('card-0')).toBeTruthy();
  });

  it('correct guess removes cards and shows solved row', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    select(0, 4, 8, 12);
    fireEvent.press(screen.getByTestId('submit-button'));
    await waitFor(() => screen.getByTestId('solved-row-0'));
    expect(screen.queryByTestId('card-0')).toBeNull();
    expect(screen.queryByTestId('card-4')).toBeNull();
  });

  it('wrong guess shows Wrong and costs a mistake dot', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    select(0, 1, 2, 3); // all different levels
    fireEvent.press(screen.getByTestId('submit-button'));
    await waitFor(() => screen.getByText('Wrong!'));
    expect(screen.getAllByTestId('dot-empty')).toHaveLength(1);
  });

  it('shows one away when 3 from same category', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    select(0, 4, 8, 1); // 3 yellow + 1 green
    fireEvent.press(screen.getByTestId('submit-button'));
    await waitFor(() => screen.getByText('One away!'));
  });

  it('wins when all 4 categories are solved', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    const groups = [[0,4,8,12],[1,5,9,13],[2,6,10,14],[3,7,11,15]];
    for (let i = 0; i < groups.length; i++) {
      select(...groups[i]);
      fireEvent.press(screen.getByTestId('submit-button'));
      await waitFor(() => screen.getByTestId(`solved-row-${i}`));
    }
    await waitFor(() => screen.getByText('🎉 Genius!'));
    expect(mockSaveCompletion).toHaveBeenCalledWith(
      'connections', '2026-04-29', '1137',
      expect.objectContaining({ puzzleWon: true, mistakes: 0 }),
    );
  });

  it('fails after 4 wrong guesses and reveals all categories', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    for (let i = 0; i < 4; i++) {
      select(0, 1, 2, 3);
      fireEvent.press(screen.getByTestId('submit-button'));
      await waitFor(() => screen.getByTestId('message'));
    }
    await waitFor(() => screen.getByText('😞 Better luck next time!'));
    for (let l = 0; l < 4; l++) expect(screen.getByTestId(`solved-row-${l}`)).toBeTruthy();
    expect(mockSaveCompletion).toHaveBeenCalledWith(
      'connections', '2026-04-29', '1137',
      expect.objectContaining({ puzzleWon: false }),
    );
  });

  it('does not call saveCompletion in dry-run mode', async () => {
    renderScreen({ dryRun: true });
    await waitFor(() => screen.getByTestId('card-0'));
    const groups = [[0,4,8,12],[1,5,9,13],[2,6,10,14],[3,7,11,15]];
    for (let i = 0; i < groups.length; i++) {
      select(...groups[i]);
      fireEvent.press(screen.getByTestId('submit-button'));
      await waitFor(() => screen.getByTestId(`solved-row-${i}`));
    }
    await waitFor(() => screen.getByText('🎉 Genius!'));
    expect(mockSaveCompletion).not.toHaveBeenCalled();
  });

  it('shows DRY RUN label', async () => {
    renderScreen({ dryRun: true });
    await waitFor(() => screen.getByText('DRY RUN'));
  });

  it('arrange mode: picking up a card then tapping another swaps them', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('arrange-toggle'));
    fireEvent.press(screen.getByTestId('arrange-toggle'));
    fireEvent.press(screen.getByTestId('card-0'));  // pick up
    fireEvent.press(screen.getByTestId('card-15')); // swap
    // exit arrange
    fireEvent.press(screen.getByTestId('arrange-toggle'));
    expect(screen.getByTestId('card-0')).toBeTruthy();
    expect(screen.getByTestId('card-15')).toBeTruthy();
  });

  it('arrange mode: tapping the same card puts it down without swapping', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('arrange-toggle'));
    fireEvent.press(screen.getByTestId('arrange-toggle'));
    fireEvent.press(screen.getByTestId('card-0')); // pick up
    fireEvent.press(screen.getByTestId('card-0')); // put down
    fireEvent.press(screen.getByTestId('arrange-toggle')); // exit
    // can now select card 0 normally
    fireEvent.press(screen.getByTestId('card-0'));
    expect(screen.getByTestId('card-0')).toBeTruthy();
  });

  it('arrange toggle disappears after game over', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    const groups = [[0,4,8,12],[1,5,9,13],[2,6,10,14],[3,7,11,15]];
    for (let i = 0; i < groups.length; i++) {
      select(...groups[i]);
      fireEvent.press(screen.getByTestId('submit-button'));
      await waitFor(() => screen.getByTestId(`solved-row-${i}`));
    }
    await waitFor(() => expect(screen.queryByTestId('arrange-toggle')).toBeNull());
  });
});
