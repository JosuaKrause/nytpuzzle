jest.mock('react-native-svg', () => ({ SvgUri: () => null }));

const realWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  realWarn(...args);
  throw new Error(`console.warn: ${String(args[0])}`);
};

// Animation mocks: values are set immediately (so refs are correct), but
// callbacks are deferred via Promise so React renders intermediate animation
// states between steps — required for animation-branch coverage.
import { Animated } from 'react-native';

const asyncAnim = (value: Animated.Value, config: { toValue: number }) => ({
  start: (cb?: (r: { finished: boolean }) => void) => {
    value?.setValue(config?.toValue);
    if (cb) Promise.resolve().then(() => cb({ finished: true }));
  },
});
const asyncDelay = () => ({
  start: (cb?: (r: { finished: boolean }) => void) => {
    if (cb) Promise.resolve().then(() => cb({ finished: true }));
  },
});
const asyncSequence = (animations: Array<{ start: (cb?: (r: { finished: boolean }) => void) => void }>) => ({
  start: (cb?: (r: { finished: boolean }) => void) => {
    animations.forEach(a => a.start());
    if (cb) Promise.resolve().then(() => cb({ finished: true }));
  },
});

jest.spyOn(Animated, 'timing').mockImplementation(asyncAnim as never);
jest.spyOn(Animated, 'spring').mockImplementation(asyncAnim as never);
jest.spyOn(Animated, 'delay').mockImplementation(asyncDelay as never);
jest.spyOn(Animated, 'sequence').mockImplementation(asyncSequence as never);
