const realWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  realWarn(...args);
  throw new Error(`console.warn: ${String(args[0])}`);
};

// Make Animated.timing / spring / delay run synchronously so animation
// callbacks are exercised by normal test events and 100% coverage is preserved.
import { Animated } from 'react-native';

const syncAnim = (value: Animated.Value, config: { toValue: number }) => ({
  start: (cb?: (r: { finished: boolean }) => void) => {
    value?.setValue(config?.toValue);
    cb?.({ finished: true });
  },
});
const syncDelay = () => ({
  start: (cb?: (r: { finished: boolean }) => void) => cb?.({ finished: true }),
});

jest.spyOn(Animated, 'timing').mockImplementation(syncAnim as never);
jest.spyOn(Animated, 'spring').mockImplementation(syncAnim as never);
jest.spyOn(Animated, 'delay').mockImplementation(syncDelay as never);
