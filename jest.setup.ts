const realWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  realWarn(...args);
  throw new Error(`console.warn: ${String(args[0])}`);
};

// Make all Animated primitives run synchronously so animation callbacks are
// exercised by normal test events and 100% coverage is preserved.
// Animated.sequence defers its outer callback asynchronously in the New
// Architecture even when its children are synchronous, so it must be mocked too.
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
const syncSequence = (animations: Array<{ start: (cb?: (r: { finished: boolean }) => void) => void }>) => ({
  start: (cb?: (r: { finished: boolean }) => void) => {
    animations.forEach(a => a.start());
    cb?.({ finished: true });
  },
});

jest.spyOn(Animated, 'timing').mockImplementation(syncAnim as never);
jest.spyOn(Animated, 'spring').mockImplementation(syncAnim as never);
jest.spyOn(Animated, 'delay').mockImplementation(syncDelay as never);
jest.spyOn(Animated, 'sequence').mockImplementation(syncSequence as never);
