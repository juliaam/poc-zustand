import { type StoreApi } from 'zustand'

// ---------------------------------------------------------------------------
// getApp<T>() — developer test helper
//
// Mirrors the production `getApp<IServiceA & IServiceB>()` pattern.
// Wraps a Zustand StoreApi so tests can access live state, dispatch actions,
// and subscribe to changes.
//
// Usage (lensed store):
//   const app = getApp(useDevLensed1)
//   await app.state.auth.login('Alice')
//   expect(app.state.auth.isAuthenticated).toBe(true)
//   expect(app.state.counter.doubleCount).toBe(0)   // independent
//
// Usage (flat store):
//   const app = getApp(useDevFlat)
//   app.state.reset()   // only Todo's reset runs (last spread wins)
// ---------------------------------------------------------------------------

export type AppHandle<T> = {
  /** Always returns the CURRENT snapshot of the store state. */
  readonly state: T
  /** Directly set store state (useful for test setup). */
  setState: StoreApi<T>['setState']
  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe: StoreApi<T>['subscribe']
  /**
   * Reset state back to the initial snapshot captured at call time.
   * Call this in afterEach to isolate tests from each other.
   */
  reset: () => void
}

export function getApp<T>(store: StoreApi<T>): AppHandle<T> {
  const initialState = store.getState()
  return {
    get state() {
      return store.getState()
    },
    setState: store.setState.bind(store),
    subscribe: store.subscribe.bind(store),
    reset: () => store.setState(initialState, true),
  }
}
