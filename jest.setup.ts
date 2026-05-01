const realWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  realWarn(...args);
  throw new Error(`console.warn: ${String(args[0])}`);
};
