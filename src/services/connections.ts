import type { ConnectionsCategory } from './nytClient';

export interface GameCard {
  content: string;    // empty string for image cards
  imageUrl?: string;
  imageAlt?: string;
  level: number;    // 0=yellow 1=green 2=blue 3=purple
  position: number; // 0-15 original position from puzzle (used in game_data payload)
}

export interface RecordedGuess {
  cards: Array<{ position: number; level: number }>;
  correct: boolean;
}

export interface RecordedSolvedCategory {
  cards: Array<{ position: number; level: number }>;
  level: number;
  orderSolved: number;
}

// Extract all 16 cards from puzzle categories, sorted by original position.
export function extractCards(categories: ConnectionsCategory[]): GameCard[] {
  const cards: GameCard[] = [];
  categories.forEach((cat, level) => {
    cat.cards.forEach(c => cards.push({
      content: c.content ?? '',
      imageUrl: c.image_url,
      imageAlt: c.image_alt_text,
      level,
      position: c.position,
    }));
  });
  return cards.sort((a, b) => a.position - b.position);
}

// Returns the solved category level (0-3) if all 4 selected cards share a level, else null.
export function checkGuess(selected: number[], cards: GameCard[]): number | null {
  if (selected.length !== 4) return null;
  const first = cards[selected[0]].level;
  return selected.every(i => cards[i].level === first) ? first : null;
}

// Returns the max count of cards from any single category among the selection (for "one away").
export function maxSameCategory(selected: number[], cards: GameCard[]): number {
  if (selected.length === 0) return 0;
  const counts: Record<number, number> = {};
  for (const i of selected) {
    const lvl = cards[i].level;
    counts[lvl] = (counts[lvl] || 0) + 1;
  }
  return Math.max(...Object.values(counts));
}

// Swap two card indices in a board-order array. Returns a new array.
export function swapInOrder(order: number[], cardA: number, cardB: number): number[] {
  const next = [...order];
  const posA = next.indexOf(cardA);
  const posB = next.indexOf(cardB);
  if (posA !== -1 && posB !== -1) {
    [next[posA], next[posB]] = [next[posB], next[posA]];
  }
  return next;
}

export interface CardLayout { x: number; y: number; width: number; height: number }

// Returns the card index whose layout contains the point (px, py), or null.
export function findCardAt(
  px: number,
  py: number,
  layouts: Map<number, CardLayout>,
): number | null {
  for (const [cardIdx, m] of layouts) {
    if (px >= m.x && px <= m.x + m.width && py >= m.y && py <= m.y + m.height) {
      return cardIdx;
    }
  }
  return null;
}

// Convert selected card indices to the payload shape used in game_data.
export function cardsToPayload(
  selected: number[],
  cards: GameCard[],
): Array<{ position: number; level: number }> {
  return selected.map(i => ({ position: cards[i].position, level: cards[i].level }));
}
