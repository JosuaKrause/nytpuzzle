import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Keyboard } from './Keyboard';

const onKey = jest.fn();

beforeEach(() => onKey.mockReset());

describe('Keyboard', () => {
  it('renders all letter keys', () => {
    render(<Keyboard keyColors={{}} onKey={onKey} />);
    expect(screen.getByTestId('key-A')).toBeTruthy();
    expect(screen.getByTestId('key-Z')).toBeTruthy();
    expect(screen.getByTestId('key-ENTER')).toBeTruthy();
    expect(screen.getByTestId('key-⌫')).toBeTruthy();
  });

  it('calls onKey with the pressed key', () => {
    render(<Keyboard keyColors={{}} onKey={onKey} />);
    fireEvent.press(screen.getByTestId('key-A'));
    expect(onKey).toHaveBeenCalledWith('A');
  });

  it('calls onKey with ENTER', () => {
    render(<Keyboard keyColors={{}} onKey={onKey} />);
    fireEvent.press(screen.getByTestId('key-ENTER'));
    expect(onKey).toHaveBeenCalledWith('ENTER');
  });

  it('calls onKey with ⌫', () => {
    render(<Keyboard keyColors={{}} onKey={onKey} />);
    fireEvent.press(screen.getByTestId('key-⌫'));
    expect(onKey).toHaveBeenCalledWith('⌫');
  });

  it('does not call onKey when disabled', () => {
    render(<Keyboard keyColors={{}} onKey={onKey} disabled />);
    fireEvent.press(screen.getByTestId('key-A'));
    expect(onKey).not.toHaveBeenCalled();
  });

  it('renders keys with correct and present colors', () => {
    render(<Keyboard keyColors={{ A: 'correct', B: 'present', C: 'absent' }} onKey={onKey} />);
    expect(screen.getByTestId('key-A')).toBeTruthy();
    expect(screen.getByTestId('key-B')).toBeTruthy();
    expect(screen.getByTestId('key-C')).toBeTruthy();
  });
});
