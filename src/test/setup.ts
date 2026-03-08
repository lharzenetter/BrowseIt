import '@testing-library/jest-dom';

// TanStack Virtual uses ResizeObserver to track scroll container dimensions.
// jsdom doesn't implement it, so we stub it out.
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).ResizeObserver = function ResizeObserver(
    cb: ResizeObserverCallback,
  ) {
    return {
      observe(target: Element) {
        // Fire once synchronously with zero dimensions so the virtualizer
        // initialises without crashing.
        cb(
          [{ target, contentRect: { width: 800, height: 600 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      },
      unobserve() {},
      disconnect() {},
    };
  };
}
