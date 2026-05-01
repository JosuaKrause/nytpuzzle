import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ConnectionsScreen } from './ConnectionsScreen';

const route = { params: { date: '2026-04-29' } };

it('renders game name and coming soon message', () => {
  render(<ConnectionsScreen route={route as never} navigation={{} as never} />);
  expect(screen.getByText('Connections — 2026-04-29')).toBeTruthy();
  expect(screen.getByText('Coming soon')).toBeTruthy();
});
