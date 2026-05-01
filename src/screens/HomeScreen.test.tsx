import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { HomeScreen } from './HomeScreen';
import { getCachedGames, getCompletionStatuses } from '../services/puzzleStore';
import { prefetchDate } from '../services/preloader';

jest.mock('../services/puzzleStore');
jest.mock('../services/preloader');

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockGetCachedGames = getCachedGames as jest.Mock;
const mockGetCompletionStatuses = getCompletionStatuses as jest.Mock;
const mockPrefetchDate = prefetchDate as jest.Mock;

beforeEach(() => {
  mockGetCachedGames.mockReset().mockResolvedValue([]);
  mockGetCompletionStatuses.mockReset().mockResolvedValue({});
  mockPrefetchDate.mockReset().mockResolvedValue({ fetched: [], failed: [] });
  mockNavigate.mockReset();
});

describe('HomeScreen', () => {
  it('shows loading indicator on initial render', () => {
    mockGetCachedGames.mockReturnValue(new Promise(() => {}));
    render(<HomeScreen />);
    expect(screen.getByTestId('loading')).toBeTruthy();
  });

  it('renders all 4 game rows after load', async () => {
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByTestId('row-wordle')).toBeTruthy());
    expect(screen.getByTestId('row-connections')).toBeTruthy();
    expect(screen.getByTestId('row-strands')).toBeTruthy();
    expect(screen.getByTestId('row-mini')).toBeTruthy();
  });

  it('shows Not cached when no puzzles are stored', async () => {
    render(<HomeScreen />);
    await waitFor(() => screen.getByTestId('row-wordle'));
    expect(screen.getAllByText('Not cached')).toHaveLength(4);
  });

  it('shows Ready offline for cached games', async () => {
    mockGetCachedGames.mockResolvedValue(['wordle', 'connections', 'strands', 'mini']);
    render(<HomeScreen />);
    await waitFor(() => screen.getByTestId('row-wordle'));
    expect(screen.getAllByText('Ready offline')).toHaveLength(4);
  });

  it('shows SyncBadge for games with a completion status', async () => {
    mockGetCompletionStatuses.mockResolvedValue({ wordle: 'pending', connections: 'failed' });
    render(<HomeScreen />);
    await waitFor(() => screen.getByText('Pending'));
    expect(screen.getByText('Failed')).toBeTruthy();
  });

  it('shows no SyncBadge when no completions', async () => {
    render(<HomeScreen />);
    await waitFor(() => screen.getByTestId('row-wordle'));
    expect(screen.queryByText('Pending')).toBeNull();
    expect(screen.queryByText('Synced')).toBeNull();
    expect(screen.queryByText('Failed')).toBeNull();
  });

  it('shows error message when load fails', async () => {
    mockGetCachedGames.mockRejectedValue(new Error('db error'));
    render(<HomeScreen />);
    await waitFor(() => screen.getByText('Failed to load puzzle status.'));
  });

  it('triggers prefetchDate when Preload button is pressed', async () => {
    render(<HomeScreen nytS="S" nytA="A" />);
    await waitFor(() => screen.getByTestId('preload-button'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('preload-button'));
    });
    expect(mockPrefetchDate).toHaveBeenCalledWith(expect.any(String), 'S', 'A');
  });

  it('reloads game rows after successful preload', async () => {
    mockGetCachedGames
      .mockResolvedValueOnce([])
      .mockResolvedValue(['wordle', 'connections', 'strands', 'mini']);
    render(<HomeScreen />);
    await waitFor(() => screen.getByTestId('preload-button'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('preload-button'));
    });
    await waitFor(() => expect(screen.getAllByText('Ready offline')).toHaveLength(4));
  });

  it('shows error when preload fails', async () => {
    mockPrefetchDate.mockRejectedValue(new Error('network'));
    render(<HomeScreen />);
    await waitFor(() => screen.getByTestId('preload-button'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('preload-button'));
    });
    await waitFor(() => screen.getByText('Preload failed.'));
  });

  it('disables preload button while loading', async () => {
    let resolve: () => void;
    mockPrefetchDate.mockReturnValue(new Promise<void>(r => { resolve = r; }));
    render(<HomeScreen />);
    await waitFor(() => screen.getByTestId('preload-button'));
    fireEvent.press(screen.getByTestId('preload-button'));
    await waitFor(() => expect(screen.getByText('Loading…')).toBeTruthy());
    await act(async () => { resolve!(); });
  });

  it('navigates to the game screen when a row is tapped', async () => {
    render(<HomeScreen />);
    await waitFor(() => screen.getByTestId('row-wordle'));
    fireEvent.press(screen.getByTestId('row-wordle'));
    expect(mockNavigate).toHaveBeenCalledWith('Wordle', { date: expect.any(String) });
  });

  it('navigates to previous day and reloads when prev arrow is pressed', async () => {
    render(<HomeScreen />);
    await waitFor(() => screen.getByTestId('prev-day'));
    fireEvent.press(screen.getByTestId('prev-day'));
    await waitFor(() => expect(mockGetCachedGames).toHaveBeenCalledTimes(2));
    // date shown is now one day earlier
    const today = new Date().toISOString().slice(0, 10);
    const d = new Date(today + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    const yesterday = d.toISOString().slice(0, 10);
    expect(screen.getByText(yesterday)).toBeTruthy();
  });

  it('does not advance past today when next arrow is pressed at today', async () => {
    render(<HomeScreen />);
    await waitFor(() => screen.getByTestId('next-day'));
    const today = new Date().toISOString().slice(0, 10);
    // next-day is disabled when already at today
    fireEvent.press(screen.getByTestId('next-day'));
    expect(screen.getByText(today)).toBeTruthy();
  });

  it('can navigate forward after going back', async () => {
    render(<HomeScreen />);
    await waitFor(() => screen.getByTestId('prev-day'));
    fireEvent.press(screen.getByTestId('prev-day'));
    await waitFor(() => expect(mockGetCachedGames).toHaveBeenCalledTimes(2));
    fireEvent.press(screen.getByTestId('next-day'));
    await waitFor(() => expect(mockGetCachedGames).toHaveBeenCalledTimes(3));
    const today = new Date().toISOString().slice(0, 10);
    expect(screen.getByText(today)).toBeTruthy();
  });
});
