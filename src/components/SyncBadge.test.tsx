import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SyncBadge } from './SyncBadge';

describe('SyncBadge', () => {
  it('renders Synced label', () => {
    render(<SyncBadge status="synced" />);
    expect(screen.getByText('Synced')).toBeTruthy();
  });

  it('renders Pending label', () => {
    render(<SyncBadge status="pending" />);
    expect(screen.getByText('Pending')).toBeTruthy();
  });

  it('renders Failed label', () => {
    render(<SyncBadge status="failed" />);
    expect(screen.getByText('Failed')).toBeTruthy();
  });
});
