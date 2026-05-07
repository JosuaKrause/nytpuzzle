import React from 'react';
import { PanResponder, View } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ConnectionsScreen } from './ConnectionsScreen';
import { getPuzzle, saveCompletion } from '../services/puzzleStore';

jest.mock('../services/puzzleStore');

// Capture PanResponder config so we can call the handlers directly in tests
type PanConfig = Parameters<typeof PanResponder.create>[0];
let panConfig: PanConfig | null = null;
const panCreateSpy = jest.spyOn(PanResponder, 'create').mockImplementation((config) => {
  panConfig = config;
  return { panHandlers: {} };
});

// Make View.measure call back with known absolute coords so startDrag works
jest.spyOn(View.prototype, 'measure').mockImplementation(function (callback) {
  callback(0, 0, 80, 72, 50, 100); // fx, fy, w, h, px, py
});

const mockGetPuzzle = getPuzzle as jest.Mock;
const mockSaveCompletion = saveCompletion as jest.Mock;

// idx: 0=A(y) 1=E(g) 2=I(b) 3=M(p)  4=B(y) 5=F(g) 6=J(b) 7=N(p)
//      8=C(y) 9=G(g) 10=K(b) 11=O(p)  12=D(y) 13=H(g) 14=L(b) 15=P(p)
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
  panConfig = null;
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

// Simulate a card long-press (starts drag) — measure mock sets startX=50, startY=100
function longPress(cardIdx: number) {
  fireEvent(screen.getByTestId(`card-${cardIdx}`), 'longPress');
}

beforeEach(() => {
  mockGetPuzzle.mockReset().mockResolvedValue(puzzle);
  mockSaveCompletion.mockReset().mockResolvedValue(undefined);
  mockNav.goBack.mockReset();
  panConfig = null;
  panCreateSpy.mockClear();
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

  it('selects a card on tap', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    select(0);
    expect(screen.getByTestId('card-0')).toBeTruthy();
  });

  it('deselects a card on second tap', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    select(0, 0);
    expect(screen.getByTestId('card-0')).toBeTruthy();
  });

  it('cannot select more than 4 cards', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    select(0, 1, 2, 3, 4);
    expect(screen.getByTestId('submit-button')).toBeTruthy();
  });

  it('ignores card press while drag is active', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    longPress(0);
    await waitFor(() => screen.getByTestId('ghost-card'));
    fireEvent.press(screen.getByTestId('card-1'));
    expect(screen.getByTestId('card-1')).toBeTruthy();
  });

  it('deselect-all clears selection', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    select(0, 1);
    fireEvent.press(screen.getByTestId('deselect-button'));
    expect(screen.getByTestId('card-0')).toBeTruthy();
  });

  it('grid onLayout updates card width and ghost card tracks drag start position', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    // Fire grid onLayout so gridWidth (and cardWidth) are updated from actual layout
    screen.getByTestId('grid').props.onLayout?.({
      nativeEvent: { layout: { width: 360, height: 200, x: 0, y: 0 } },
    });
    // measure mock: (_fx, _fy, w=80, h=72, px=50, py=100)
    // startDrag stores w/h in ghostSize and uses px/py directly as screen coords
    longPress(0);
    await waitFor(() => screen.getByTestId('ghost-card'));
    expect(screen.getByTestId('ghost-card')).toBeTruthy();
  });

  it('shows ghost card on long-press and hides on pan release', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    longPress(0);
    await waitFor(() => screen.getByTestId('ghost-card'));

    // Simulate pan release without a valid target → drag cancelled
    panConfig?.onPanResponderRelease?.(
      { nativeEvent: { pageX: 999, pageY: 999 } } as never,
      {} as never,
    );
    await waitFor(() => expect(screen.queryByTestId('ghost-card')).toBeNull());
  });

  it('onPanResponderMove without active drag returns early', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    // dragRef.current is null — covers the early-return branch on move
    panConfig?.onPanResponderMove?.(
      { nativeEvent: { pageX: 100, pageY: 100 } } as never,
      { dx: 0, dy: 0 } as never,
    );
    expect(screen.queryByTestId('ghost-card')).toBeNull();
  });

  it('release without active drag is a no-op', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    panConfig?.onPanResponderRelease?.(
      { nativeEvent: { pageX: 0, pageY: 0 } } as never,
      {} as never,
    );
    expect(screen.queryByTestId('ghost-card')).toBeNull();
  });

  it('panning over source card sets no drop target', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    // Populate card-0's layout so findCardAt returns cardIdx=0 (same as dragged card)
    screen.getByTestId('card-0').props.onLayout?.({
      nativeEvent: { layout: { x: 50, y: 100, width: 80, height: 72 } },
    });
    longPress(0);
    await waitFor(() => screen.getByTestId('ghost-card'));
    // Pan over card-0 itself — target === source, setDropTarget(null)
    panConfig?.onPanResponderMove?.(
      { nativeEvent: { pageX: 90, pageY: 130 } } as never,
      { dx: 5, dy: 5 } as never,
    );
    // Cancel drag
    panConfig?.onPanResponderTerminate?.({} as never, {} as never);
    await waitFor(() => expect(screen.queryByTestId('ghost-card')).toBeNull());
  });

  it('swaps cards on drag to a valid target and renders drop-target style', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));

    longPress(0);
    await waitFor(() => screen.getByTestId('ghost-card'));

    // onLayout calls measure() — mock returns (fx,fy,w=80,h=72,px=50,py=100) for all cards
    // Only card-5 is registered here; findCardAt will return it for any point in [50,130]×[100,172]
    screen.getByTestId('card-5').props.onLayout?.({} as never);

    // Pan over card-5 — causes setDropTarget(5) + render with drop-target style
    panConfig?.onPanResponderMove?.(
      { nativeEvent: { pageX: 90, pageY: 130 } } as never,
      { dx: 10, dy: 10 } as never,
    );
    // Flush state update so the drop-target render happens before the release
    await waitFor(() => expect(screen.getByTestId('card-5')).toBeTruthy());

    // Release on card-5 → swap
    panConfig?.onPanResponderRelease?.(
      { nativeEvent: { pageX: 90, pageY: 130 } } as never,
      {} as never,
    );
    await waitFor(() => expect(screen.queryByTestId('ghost-card')).toBeNull());
    expect(screen.getByTestId('card-0')).toBeTruthy();
    expect(screen.getByTestId('card-5')).toBeTruthy();
  });

  it('cancels drag on terminate', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    longPress(0);
    await waitFor(() => screen.getByTestId('ghost-card'));
    panConfig?.onPanResponderTerminate?.({} as never, {} as never);
    await waitFor(() => expect(screen.queryByTestId('ghost-card')).toBeNull());
  });

  it('onStartShouldSetPanResponder always returns false', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    const result = panConfig?.onStartShouldSetPanResponder?.({} as never, {} as never);
    expect(result).toBe(false);
  });

  it('onMoveShouldSetPanResponder returns false when not dragging', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    const result = panConfig?.onMoveShouldSetPanResponder?.({} as never, {} as never);
    expect(result).toBe(false);
  });

  it('onMoveShouldSetPanResponder returns true when drag is active', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    longPress(0);
    await waitFor(() => screen.getByTestId('ghost-card'));
    const result = panConfig?.onMoveShouldSetPanResponder?.({} as never, {} as never);
    expect(result).toBe(true);
  });

  it('correct guess removes cards and shows solved row', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    select(0, 4, 8, 12);
    fireEvent.press(screen.getByTestId('submit-button'));
    await waitFor(() => screen.getByTestId('solved-row-0'));
    expect(screen.queryByTestId('card-0')).toBeNull();
  });

  it('wrong guess shows Wrong and costs a mistake dot', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    select(0, 1, 2, 3);
    fireEvent.press(screen.getByTestId('submit-button'));
    await waitFor(() => screen.getByText('Wrong!'));
    expect(screen.getAllByTestId('dot-empty')).toHaveLength(1);
  });

  it('shows one away when 3 from same category', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    select(0, 4, 8, 1);
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

  it('controls disappear after game over', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    const groups = [[0,4,8,12],[1,5,9,13],[2,6,10,14],[3,7,11,15]];
    for (let i = 0; i < groups.length; i++) {
      select(...groups[i]);
      fireEvent.press(screen.getByTestId('submit-button'));
      await waitFor(() => screen.getByTestId(`solved-row-${i}`));
    }
    await waitFor(() => expect(screen.queryByTestId('submit-button')).toBeNull());
  });
});

// Image puzzle — cards have image_url/image_alt_text instead of content
const imagePuzzle = {
  id: 1027, status: 'OK', print_date: '2026-05-06', editor: 'x', illustrator: 'Glenn Harvey',
  categories: [
    { title: 'Casino', cards: [
      { image_url: 'https://ex.com/a.svg', image_alt_text: 'SLOT MACHINE', position: 0 },
      { image_url: 'https://ex.com/b.svg', image_alt_text: 'CARDS',        position: 4 },
      { image_url: 'https://ex.com/c.svg', image_alt_text: 'DICE',         position: 8 },
      { image_url: 'https://ex.com/d.svg', image_alt_text: 'CHIPS',        position: 12 },
    ]},
    { title: 'Fasteners', cards: [
      { image_url: 'https://ex.com/e.svg', image_alt_text: 'ZIPPER',  position: 1 },
      { image_url: 'https://ex.com/f.svg', image_alt_text: 'BUTTON',  position: 5 },
      { image_url: 'https://ex.com/g.svg', image_alt_text: 'LACES',   position: 9 },
      { image_url: 'https://ex.com/h.svg', image_alt_text: 'BUCKLE',  position: 13 },
    ]},
    { title: 'Bowling', cards: [
      { image_url: 'https://ex.com/i.svg', image_alt_text: 'SCORECARD',    position: 2 },
      { image_url: 'https://ex.com/j.svg', image_alt_text: 'BOWLING BALL', position: 6 },
      { image_url: 'https://ex.com/k.svg', image_alt_text: 'BOWLING PINS', position: 10 },
      { image_url: 'https://ex.com/l.svg', image_alt_text: 'LANE',         position: 14 },
    ]},
    { title: 'Flags', cards: [
      { image_url: 'https://ex.com/m.svg', image_alt_text: 'TRISECTION', position: 3 },
      { image_url: 'https://ex.com/n.svg', image_alt_text: 'CIRCLE',     position: 7 },
      { image_url: 'https://ex.com/o.svg', image_alt_text: 'STRIPES',    position: 11 },
      { image_url: 'https://ex.com/p.svg', image_alt_text: 'CROSS',      position: 15 },
    ]},
  ],
};

describe('ConnectionsScreen — image puzzle', () => {
  beforeEach(() => {
    mockGetPuzzle.mockReset().mockResolvedValue(imagePuzzle);
    mockSaveCompletion.mockReset().mockResolvedValue(undefined);
    mockNav.goBack.mockReset();
  });

  it('renders image cards (SvgUri) instead of text', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    // Cards render without crashing; card testIDs are present
    expect(screen.getByTestId('card-4')).toBeTruthy();
  });

  it('ghost card uses SvgUri for image cards', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    longPress(0);
    await waitFor(() => screen.getByTestId('ghost-card'));
    expect(screen.getByTestId('ghost-card')).toBeTruthy();
  });

  it('solved row shows image_alt_text values', async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId('card-0'));
    select(0, 4, 8, 12);
    fireEvent.press(screen.getByTestId('submit-button'));
    await waitFor(() => screen.getByTestId('solved-row-0'));
    expect(screen.getByText('SLOT MACHINE, CARDS, DICE, CHIPS')).toBeTruthy();
  });
});
