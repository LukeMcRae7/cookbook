/** Shared test setup. Runs for both the node and jsdom environments. */

// React needs this flag to accept act() outside of a testing-library harness.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

// jsdom defines window.scrollTo but throws "not implemented" when it is called.
if (typeof window !== 'undefined') {
  window.scrollTo = (() => {}) as typeof window.scrollTo
}
