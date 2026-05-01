import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MiniScreen } from './MiniScreen';

const route = { params: { date: '2026-04-29' } };

it('renders game name and coming soon message', () => {
  render(<MiniScreen route={route as never} navigation={{} as never} />);
  expect(screen.getByText('Mini Crossword — 2026-04-29')).toBeTruthy();
  expect(screen.getByText('Coming soon')).toBeTruthy();
});
