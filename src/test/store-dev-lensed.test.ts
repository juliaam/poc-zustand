import { describe, it, expect, beforeEach } from 'vitest'
import { getApp } from './get-app'
import { useDevLensed1 } from '../stores/store-dev-lensed-1'
import { useDevLensed2 } from '../stores/store-dev-lensed-2'

// ---------------------------------------------------------------------------
// Lensed stores — developer ergonomics test suite
//
// Pattern mirrors production:
//   const app = getApp(useDevLensed1)
//   await app.state.auth.login('Alice')
//   expect(app.state.auth.isAuthenticated).toBe(true)
// ---------------------------------------------------------------------------

describe('Store 1 (lensed) — name isolation', () => {
  const app = getApp(useDevLensed1)
  beforeEach(() => app.reset())

  it('auth.reset() only resets auth — counter and todo are unaffected', () => {
    app.state.counter.increment()
    app.state.counter.increment()
    app.state.addTodo('keep me')
    app.state.auth.reset()

    expect(app.state.auth.isAuthenticated).toBe(false)
    expect(app.state.auth.user).toBeNull()
    expect(app.state.counter.count).toBe(2)   // untouched
    expect(app.state.todos).toHaveLength(1)      // untouched
  })

  it('counter.reset() only resets counter — auth and todo are unaffected', () => {
    app.state.addTodo('item A')
    app.state.counter.increment()
    // Give auth some state via direct setState so we avoid async in this test
    app.setState((s) => ({ ...s, auth: { ...s.auth, user: 'Bob', isAuthenticated: true } }))

    app.state.counter.reset()

    expect(app.state.counter.count).toBe(0)
    expect(app.state.counter.isLoading).toBe(false)
    expect(app.state.auth.isAuthenticated).toBe(true)  // untouched
    expect(app.state.todos).toHaveLength(1)              // untouched
  })

  it('todo.reset() only resets todo — auth and counter are unaffected', () => {
    app.state.counter.increment()
    app.state.counter.increment()
    app.state.counter.increment()
    app.state.addTodo('item 1')
    app.state.addTodo('item 2')

    app.state.reset()

    expect(app.state.todos).toHaveLength(0)
    expect(app.state.isLoading).toBe(false)
    expect(app.state.counter.count).toBe(3)   // untouched
  })

  it('isLoading is independent per service', () => {
    app.state.counter.setLoading(true)

    expect(app.state.counter.isLoading).toBe(true)
    expect(app.state.auth.isLoading).toBe(false)   // independent
    expect(app.state.isLoading).toBe(false)         // independent (root todo)
  })
})

describe('Store 1 (lensed) — computed values', () => {
  const app = getApp(useDevLensed1)
  beforeEach(() => app.reset())

  it('doubleCount updates when count changes', () => {
    expect(app.state.counter.doubleCount).toBe(0)
    app.state.counter.increment()
    expect(app.state.counter.count).toBe(1)
    expect(app.state.counter.doubleCount).toBe(2)
    app.state.counter.increment()
    expect(app.state.counter.doubleCount).toBe(4)
  })

  it('isPositive reflects sign of count', () => {
    expect(app.state.counter.isPositive).toBe(false)
    app.state.counter.increment()
    expect(app.state.counter.isPositive).toBe(true)
    app.state.counter.decrement()
    app.state.counter.decrement()
    expect(app.state.counter.isPositive).toBe(false)
  })

  it('totalTodos and hasTodos update when todos change', () => {
    expect(app.state.totalTodos).toBe(0)
    expect(app.state.hasTodos).toBe(false)
    app.state.addTodo('first')
    expect(app.state.totalTodos).toBe(1)
    expect(app.state.hasTodos).toBe(true)
    app.state.addTodo('second')
    expect(app.state.totalTodos).toBe(2)
    app.state.removeTodo(0)
    expect(app.state.totalTodos).toBe(1)
  })

  it('displayName is "Guest" initially and updates after login', async () => {
    expect(app.state.auth.displayName).toBe('Guest')
    await app.state.auth.login('Alice')
    expect(app.state.auth.displayName).toBe('Alice')
  })
})

describe('Store 1 (lensed) — cross-lens computed (summary)', () => {
  const app = getApp(useDevLensed1)
  beforeEach(() => app.reset())

  it('summary reflects initial state', () => {
    expect(app.state.summary).toBe('Guest | count=0 (x2=0) | todos=0')
  })

  it('summary updates after counter changes', () => {
    app.state.counter.increment()
    app.state.counter.increment()
    expect(app.state.summary).toContain('count=2')
    expect(app.state.summary).toContain('x2=4')
  })

  it('summary updates after todo changes', () => {
    app.state.addTodo('task')
    expect(app.state.summary).toContain('todos=1')
  })

  it('summary updates after auth login', async () => {
    await app.state.auth.login('Bob')
    expect(app.state.summary).toContain('Bob')
    expect(app.state.summary).not.toContain('Guest')
  })

  it('summary reflects combined state from all three services', async () => {
    await app.state.auth.login('Carol')
    app.state.counter.increment()
    app.state.counter.increment()
    app.state.counter.increment()
    app.state.addTodo('a')
    app.state.addTodo('b')

    expect(app.state.summary).toBe('Carol | count=3 (x2=6) | todos=2')
  })
})

describe('Store 1 (lensed) — async operations', () => {
  const app = getApp(useDevLensed1)
  beforeEach(() => app.reset())

  it('auth.login sets isLoading during fetch then clears it', async () => {
    expect(app.state.auth.isLoading).toBe(false)
    const loginPromise = app.state.auth.login('Dave')
    // isLoading goes true synchronously inside the async action
    expect(app.state.auth.isLoading).toBe(true)
    await loginPromise
    expect(app.state.auth.isLoading).toBe(false)
    expect(app.state.auth.isAuthenticated).toBe(true)
    expect(app.state.auth.user).toBe('Dave')
  })

  it('todo.fetchTodos populates todos and clears isLoading', async () => {
    expect(app.state.todos).toHaveLength(0)
    await app.state.fetchTodos()
    expect(app.state.todos).toEqual(['Fetched item 1', 'Fetched item 2'])
    expect(app.state.isLoading).toBe(false)
    expect(app.state.totalTodos).toBe(2)
    expect(app.state.hasTodos).toBe(true)
  })

  it('auth.isLoading does not affect todo.isLoading during auth login', async () => {
    const loginPromise = app.state.auth.login('Eve')
    expect(app.state.auth.isLoading).toBe(true)
    expect(app.state.isLoading).toBe(false)  // independent (root todo)
    await loginPromise
  })
})

// ---------------------------------------------------------------------------
// Store 2 — additional features (role, step) and store independence
// ---------------------------------------------------------------------------

describe('Store 2 (lensed) — independence from Store 1', () => {
  const app1 = getApp(useDevLensed1)
  const app2 = getApp(useDevLensed2)
  beforeEach(() => {
    app1.reset()
    app2.reset()
  })

  it('mutations in Store 1 do not affect Store 2', () => {
    app1.state.counter.increment()
    app1.state.counter.increment()
    app1.state.counter.increment()
    app1.state.addTodo('store1 item')

    expect(app2.state.counter.count).toBe(0)
    expect(app2.state.todo.todos).toHaveLength(0)
  })

  it('mutations in Store 2 do not affect Store 1', () => {
    app2.state.counter.increment()
    app2.state.counter.increment()
    app2.state.todo.addTodo('store2 item')

    expect(app1.state.counter.count).toBe(0)
    expect(app1.state.todos).toHaveLength(0)
  })
})

describe('Store 2 (lensed) — additional features', () => {
  const app = getApp(useDevLensed2)
  beforeEach(() => app.reset())

  it('counter increments by custom step', () => {
    app.state.counter.setStep(5)
    app.state.counter.increment()
    expect(app.state.counter.count).toBe(5)
    expect(app.state.counter.doubleCount).toBe(10)
  })

  it('counter.reset() restores step to 1', () => {
    app.state.counter.setStep(10)
    app.state.counter.increment()
    app.state.counter.reset()
    expect(app.state.counter.count).toBe(0)
    expect(app.state.counter.step).toBe(1)
  })

  it('auth.login with role sets isAdmin computed', async () => {
    await app.state.auth.login('Admin User', 'admin')
    expect(app.state.auth.isAdmin).toBe(true)
    expect(app.state.auth.displayName).toBe('Admin User (admin)')

    app.state.auth.logout()
    await app.state.auth.login('Viewer User', 'viewer')
    expect(app.state.auth.isAdmin).toBe(false)
    expect(app.state.auth.displayName).toBe('Viewer User (viewer)')
  })

  it('todo.setFilter does not lose todos', () => {
    app.state.todo.addTodo('item 1')
    app.state.todo.addTodo('item 2')
    app.state.todo.setFilter('done')
    expect(app.state.todo.todos).toHaveLength(2)
    expect(app.state.todo.filter).toBe('done')
    expect(app.state.todo.totalTodos).toBe(2)
  })

  it('summary includes admin flag and filter', async () => {
    await app.state.auth.login('Alice', 'admin')
    app.state.todo.setFilter('pending')
    expect(app.state.summary).toContain('[ADMIN]')
    expect(app.state.summary).toContain('filter=pending')
  })

  it('todo.reset() restores filter to all', () => {
    app.state.todo.addTodo('a')
    app.state.todo.setFilter('done')
    app.state.todo.reset()
    expect(app.state.todo.todos).toHaveLength(0)
    expect(app.state.todo.filter).toBe('all')
  })

  it('fetchTodos sets 3 items', async () => {
    await app.state.todo.fetchTodos()
    expect(app.state.todo.todos).toEqual(['Fetched A', 'Fetched B', 'Fetched C'])
    expect(app.state.todo.totalTodos).toBe(3)
  })
})
