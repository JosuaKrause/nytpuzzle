import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StrandsScreen } from './StrandsScreen';

const route = { params: { date: '2026-04-29' } };

it('renders game name and coming soon message', () => {
  render(<StrandsScreen route={route as never} navigation={{} as never} />);
  expect(screen.getByText('Strands — 2026-04-29')).toBeTruthy();
  expect(screen.getByText('Coming soon')).toBeTruthy();
});
