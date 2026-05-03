import { extractCards, checkGuess, maxSameCategory, swapInOrder, cardsToPayload } from './connections';
import type { ConnectionsCategory } from './nytClient';

// 4 categories, each card's position interleaved so sort order differs from category order
const categories: ConnectionsCategory[] = [
  { title: 'Yellow', cards: [{ content: 'A', position: 0 }, { content: 'B', position: 4 }, { content: 'C', position: 8 }, { content: 'D', position: 12 }] },
  { title: 'Green',  cards: [{ content: 'E', position: 1 }, { content: 'F', position: 5 }, { content: 'G', position: 9 }, { content: 'H', position: 13 }] },
  { title: 'Blue',   cards: [{ content: 'I', position: 2 }, { content: 'J', position: 6 }, { content: 'K', position: 10 }, { content: 'L', position: 14 }] },
  { title: 'Purple', cards: [{ content: 'M', position: 3 }, { content: 'N', position: 7 }, { content: 'O', position: 11 }, { content: 'P', position: 15 }] },
];

describe('extractCards', () => {
  it('returns 16 cards sorted by position', () => {
    const cards = extractCards(categories);
    expect(cards).toHaveLength(16);
    expect(cards.map(c => c.position)).toEqual([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
  });

  it('assigns level from category index', () => {
    const cards = extractCards(categories);
    expect(cards[0].level).toBe(0); // pos 0 → Yellow
    expect(cards[1].level).toBe(1); // pos 1 → Green
    expect(cards[2].level).toBe(2); // pos 2 → Blue
    expect(cards[3].level).toBe(3); // pos 3 → Purple
  });

  it('preserves card content', () => {
    const cards = extractCards(categories);
    expect(cards[0].content).toBe('A');
    expect(cards[4].content).toBe('B');
  });
});

describe('checkGuess', () => {
  const cards = extractCards(categories);
  // Yellow cards are at indices 0,4,8,12 (positions 0,4,8,12)

  it('returns the level when all 4 are from the same category', () => {
    expect(checkGuess([0, 4, 8, 12], cards)).toBe(0);
  });

  it('returns null when cards span multiple categories', () => {
    expect(checkGuess([0, 1, 2, 3], cards)).toBeNull();
  });

  it('returns null when fewer than 4 are selected', () => {
    expect(checkGuess([0, 4, 8], cards)).toBeNull();
  });

  it('returns correct level for each difficulty', () => {
    expect(checkGuess([1, 5, 9, 13], cards)).toBe(1);  // Green
    expect(checkGuess([2, 6, 10, 14], cards)).toBe(2); // Blue
    expect(checkGuess([3, 7, 11, 15], cards)).toBe(3); // Purple
  });
});

describe('maxSameCategory', () => {
  const cards = extractCards(categories);

  it('returns 0 for empty selection', () => {
    expect(maxSameCategory([], cards)).toBe(0);
  });

  it('returns 4 when all are from the same category', () => {
    expect(maxSameCategory([0, 4, 8, 12], cards)).toBe(4);
  });

  it('returns 3 for one-away selection', () => {
    // 3 yellow + 1 green
    expect(maxSameCategory([0, 4, 8, 1], cards)).toBe(3);
  });

  it('returns 1 when all from different categories', () => {
    expect(maxSameCategory([0, 1, 2, 3], cards)).toBe(1);
  });
});

describe('swapInOrder', () => {
  it('swaps two elements in the order array', () => {
    expect(swapInOrder([0, 1, 2, 3], 0, 3)).toEqual([3, 1, 2, 0]);
  });

  it('returns original order when a card is not in the array', () => {
    expect(swapInOrder([0, 1, 2], 0, 99)).toEqual([0, 1, 2]);
  });

  it('does not mutate the original array', () => {
    const order = [0, 1, 2, 3];
    swapInOrder(order, 0, 3);
    expect(order).toEqual([0, 1, 2, 3]);
  });
});

describe('cardsToPayload', () => {
  const cards = extractCards(categories);

  it('returns position and level for each selected card', () => {
    const payload = cardsToPayload([0, 4], cards);
    expect(payload).toEqual([
      { position: 0, level: 0 },
      { position: 4, level: 0 },
    ]);
  });
});
