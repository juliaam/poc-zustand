import { describe, it, expect, beforeEach } from 'vitest'
import { getApp } from './get-app'
import { useDevFlat } from '../stores/store-dev-flat'

// ---------------------------------------------------------------------------
// Flat store — documents the name-collision problem that lenses solve.
//
// Key assertions here are intentionally counter-intuitive: they prove that
// the last-spread service WINS and the others are silently overwritten.
// ---------------------------------------------------------------------------

describe('Flat store — name collision: reset()', () => {
  const app = getApp(useDevFlat)
  beforeEach(() => app.reset())

  it('reset() calls TODO service implementation (last spread wins)', () => {
    // Set some state in all three services first
    app.state.increment()
    app.state.increment()
    app.state.addTodo('task A')
    // Give auth some state
    app.setState((s) => ({
      ...s,
      isAuthenticated: true,
      user: 'Alice',
      sessionToken: 'tok_Alice',
    }))

    // Calling reset() invokes ONLY the Todo service's reset
    app.state.reset()

    // ✅ Todos are reset — Todo.reset() ran
    expect(app.state.todos).toHaveLength(0)
    expect(app.state.lastAdded).toBeNull()

    // ❌ Counter is NOT reset — Counter.reset() was overwritten
    expect(app.state.count).toBe(2)
    expect(app.state.incrementCount).toBe(2)

    // ❌ Auth is NOT reset — Auth.reset() was overwritten
    expect(app.state.isAuthenticated).toBe(true)
    expect(app.state.user).toBe('Alice')
  })

  it('reset() does not clear count (Counter.reset was overwritten)', () => {
    app.state.increment()
    app.state.increment()
    app.state.increment()
    app.state.reset()

    // If lenses were used, counter.reset() would set count to 0.
    // In the flat store, Todo.reset() runs and does NOT touch count.
    expect(app.state.count).toBe(3)
  })

  it('reset() does not restore isAuthenticated (Auth.reset was overwritten)', async () => {
    await app.state.login('Bob')
    expect(app.state.isAuthenticated).toBe(true)

    app.state.reset()

    // Auth.reset() was overwritten by Counter.reset which was overwritten by Todo.reset.
    // None of them clear isAuthenticated.
    expect(app.state.isAuthenticated).toBe(true)
  })
})

describe('Flat store — name collision: isLoading', () => {
  const app = getApp(useDevFlat)
  beforeEach(() => app.reset())

  it('a single isLoading is shared — todo fetchTodos affects auth.isLoading too', async () => {
    // In the flat store, there is only ONE isLoading field.
    // Whichever service sets it, all services see the same value.
    const fetchPromise = app.state.fetchTodos()
    expect(app.state.isLoading).toBe(true)  // set by Todo's fetchTodos
    await fetchPromise
    expect(app.state.isLoading).toBe(false)
  })

  it('auth login sets the shared isLoading — todos see it too', async () => {
    const loginPromise = app.state.login('Charlie')
    expect(app.state.isLoading).toBe(true)  // same field!
    await loginPromise
    expect(app.state.isLoading).toBe(false)
  })
})

describe('Flat store — non-colliding fields work correctly', () => {
  const app = getApp(useDevFlat)
  beforeEach(() => app.reset())

  it('count, todos, user are independent (no collision)', async () => {
    app.state.increment()
    app.state.increment()
    app.state.addTodo('item 1')
    await app.state.login('Dave')

    expect(app.state.count).toBe(2)
    expect(app.state.todos).toEqual(['item 1'])
    expect(app.state.user).toBe('Dave')
    expect(app.state.sessionToken).toBe('tok_Dave')
  })

  it('incrementCount is unique to counter and accumulates correctly', () => {
    expect(app.state.incrementCount).toBe(0)
    app.state.increment()
    app.state.increment()
    app.state.increment()
    expect(app.state.incrementCount).toBe(3)
    app.state.decrement()
    expect(app.state.incrementCount).toBe(3)  // decrement doesn't touch incrementCount
  })

  it('lastAdded tracks the most recently added todo', () => {
    expect(app.state.lastAdded).toBeNull()
    app.state.addTodo('first')
    expect(app.state.lastAdded).toBe('first')
    app.state.addTodo('second')
    expect(app.state.lastAdded).toBe('second')
  })

  it('sessionToken is unique to auth and set on login', async () => {
    expect(app.state.sessionToken).toBeNull()
    await app.state.login('Eve')
    expect(app.state.sessionToken).toBe('tok_Eve')
    app.state.logout()
    expect(app.state.sessionToken).toBeNull()
  })
})

describe('Flat store — computed values', () => {
  const app = getApp(useDevFlat)
  beforeEach(() => app.reset())

  it('doubleCount updates on every increment/decrement', () => {
    expect(app.state.doubleCount).toBe(0)
    app.state.increment()
    expect(app.state.doubleCount).toBe(2)
    app.state.decrement()
    app.state.decrement()
    expect(app.state.doubleCount).toBe(-2)
  })

  it('isPositive is false when count <= 0', () => {
    expect(app.state.isPositive).toBe(false)
    app.state.increment()
    expect(app.state.isPositive).toBe(true)
    app.state.decrement()
    expect(app.state.isPositive).toBe(false)
  })

  it('totalTodos and hasTodos update on add/remove', () => {
    expect(app.state.totalTodos).toBe(0)
    expect(app.state.hasTodos).toBe(false)
    app.state.addTodo('a')
    expect(app.state.totalTodos).toBe(1)
    expect(app.state.hasTodos).toBe(true)
    app.state.removeTodo(0)
    expect(app.state.totalTodos).toBe(0)
    expect(app.state.hasTodos).toBe(false)
  })

  it('displayName updates after login', async () => {
    expect(app.state.displayName).toBe('Guest')
    await app.state.login('Frank')
    expect(app.state.displayName).toBe('Frank')
    app.state.logout()
    expect(app.state.displayName).toBe('Guest')
  })

  it('summary is a cross-service computed string', async () => {
    await app.state.login('Grace')
    app.state.increment()
    app.state.addTodo('todo 1')
    expect(app.state.summary).toBe('Grace | count=1 (x2=2) | todos=1')
  })
})

describe('Flat store — async operations', () => {
  const app = getApp(useDevFlat)
  beforeEach(() => app.reset())

  it('fetchTodos populates todos and clears isLoading', async () => {
    await app.state.fetchTodos()
    expect(app.state.todos).toEqual(['Fetched item 1', 'Fetched item 2'])
    expect(app.state.isLoading).toBe(false)
    expect(app.state.totalTodos).toBe(2)
  })

  it('login sets isAuthenticated and user', async () => {
    await app.state.login('Hank')
    expect(app.state.isAuthenticated).toBe(true)
    expect(app.state.user).toBe('Hank')
    expect(app.state.isLoading).toBe(false)
  })
})
