import { useState } from 'react'
import { useDevLensed1 } from '../stores/store-dev-lensed-1'
import { useDevLensed2 } from '../stores/store-dev-lensed-2'
import { useDevFlat } from '../stores/store-dev-flat'
import { StorePanel, ValueDisplay } from './StorePanel'

// ---- Lensed Store 1 panel ----

function DevLensed1Panel() {
  const store = useDevLensed1()
  const [loginUser, setLoginUser] = useState('Alice')

  return (
    <StorePanel
      title="Dev Lensed Store 1"
      description="Auth & Counter under lens(). Todo flat at root. reset/isLoading isolated per lens; todo has its own at root."
    >
      <div className="service-section">
        <h3>Auth (lens)</h3>
        <ValueDisplay label="isAuthenticated" value={store.auth.isAuthenticated} />
        <ValueDisplay label="user" value={store.auth.user ?? '(null)'} />
        <ValueDisplay label="isLoading" value={store.auth.isLoading} />
        <ValueDisplay label="displayName" value={store.auth.displayName} isComputed />
        <div className="actions">
          <input
            value={loginUser}
            onChange={(e) => setLoginUser(e.target.value)}
            placeholder="username"
            style={{ width: 100 }}
          />
          <button onClick={() => store.auth.login(loginUser)}>Login</button>
          <button onClick={() => store.auth.logout()}>Logout</button>
          <button onClick={() => store.auth.reset()}>Reset Auth</button>
        </div>
      </div>

      <div className="service-section">
        <h3>Counter (lens)</h3>
        <ValueDisplay label="count" value={store.counter.count} />
        <ValueDisplay label="isLoading" value={store.counter.isLoading} />
        <ValueDisplay label="doubleCount" value={store.counter.doubleCount} isComputed />
        <ValueDisplay label="isPositive" value={store.counter.isPositive} isComputed />
        <div className="actions">
          <button onClick={() => store.counter.increment()}>+1</button>
          <button onClick={() => store.counter.decrement()}>-1</button>
          <button onClick={() => store.counter.setLoading(true)}>Set Loading</button>
          <button onClick={() => store.counter.reset()}>Reset Counter</button>
        </div>
      </div>

      <div className="service-section">
        <h3>Todo (flat/root)</h3>
        <ValueDisplay label="todos" value={JSON.stringify(store.todos)} />
        <ValueDisplay label="isLoading" value={store.isLoading} />
        <ValueDisplay label="totalTodos" value={store.totalTodos} isComputed />
        <ValueDisplay label="hasTodos" value={store.hasTodos} isComputed />
        <div className="actions">
          <button onClick={() => store.addTodo(`Item ${Date.now()}`)}>Add Todo</button>
          <button onClick={() => store.fetchTodos()}>Fetch Todos</button>
          <button onClick={() => store.reset()}>Reset Todo</button>
        </div>
      </div>

      <div className="service-section cross-lens">
        <h3>Cross-Lens Computed</h3>
        <ValueDisplay label="summary" value={store.summary} isComputed />
      </div>
    </StorePanel>
  )
}

// ---- Lensed Store 2 panel ----

function DevLensed2Panel() {
  const store = useDevLensed2()

  return (
    <StorePanel
      title="Dev Lensed Store 2"
      description="Same lens pattern, different services (role-aware auth, step counter, filtered todos). Independent from Store 1."
    >
      <div className="service-section">
        <h3>Auth (lens) — with role</h3>
        <ValueDisplay label="isAuthenticated" value={store.auth.isAuthenticated} />
        <ValueDisplay label="user" value={store.auth.user ?? '(null)'} />
        <ValueDisplay label="role" value={store.auth.role ?? '(null)'} />
        <ValueDisplay label="isLoading" value={store.auth.isLoading} />
        <ValueDisplay label="displayName" value={store.auth.displayName} isComputed />
        <ValueDisplay label="isAdmin" value={store.auth.isAdmin} isComputed />
        <div className="actions">
          <button onClick={() => store.auth.login('Admin', 'admin')}>Login Admin</button>
          <button onClick={() => store.auth.login('Viewer', 'viewer')}>Login Viewer</button>
          <button onClick={() => store.auth.logout()}>Logout</button>
          <button onClick={() => store.auth.reset()}>Reset Auth</button>
        </div>
      </div>

      <div className="service-section">
        <h3>Counter (lens) — with step</h3>
        <ValueDisplay label="count" value={store.counter.count} />
        <ValueDisplay label="step" value={store.counter.step} />
        <ValueDisplay label="doubleCount" value={store.counter.doubleCount} isComputed />
        <ValueDisplay label="isPositive" value={store.counter.isPositive} isComputed />
        <div className="actions">
          <button onClick={() => store.counter.increment()}>+step</button>
          <button onClick={() => store.counter.decrement()}>-step</button>
          <button onClick={() => store.counter.setStep(5)}>Step=5</button>
          <button onClick={() => store.counter.setStep(1)}>Step=1</button>
          <button onClick={() => store.counter.reset()}>Reset Counter</button>
        </div>
      </div>

      <div className="service-section">
        <h3>Todo (lens) — with filter</h3>
        <ValueDisplay label="todos" value={JSON.stringify(store.todo.todos)} />
        <ValueDisplay label="filter" value={store.todo.filter} />
        <ValueDisplay label="totalTodos" value={store.todo.totalTodos} isComputed />
        <ValueDisplay label="hasTodos" value={store.todo.hasTodos} isComputed />
        <div className="actions">
          <button onClick={() => store.todo.addTodo(`Item ${Date.now()}`)}>Add Todo</button>
          <button onClick={() => store.todo.fetchTodos()}>Fetch Todos</button>
          <button onClick={() => store.todo.setFilter('done')}>Filter: done</button>
          <button onClick={() => store.todo.setFilter('all')}>Filter: all</button>
          <button onClick={() => store.todo.reset()}>Reset Todo</button>
        </div>
      </div>

      <div className="service-section cross-lens">
        <h3>Cross-Lens Computed</h3>
        <ValueDisplay label="summary" value={store.summary} isComputed />
      </div>
    </StorePanel>
  )
}

// ---- Flat Store panel ----

function DevFlatPanel() {
  const store = useDevFlat()

  return (
    <StorePanel
      title="Dev Flat Store (collision demo)"
      description="3 services spread flat. reset() and isLoading collide — the TODO service wins (last spread)."
    >
      <div className="service-section" style={{ borderLeft: '3px solid var(--color-error, #e53e3e)' }}>
        <h3>Auth fields (flat)</h3>
        <ValueDisplay label="isAuthenticated" value={store.isAuthenticated} />
        <ValueDisplay label="user" value={store.user ?? '(null)'} />
        <ValueDisplay label="sessionToken" value={store.sessionToken ?? '(null)'} />
        <ValueDisplay label="displayName" value={store.displayName} isComputed />
        <div className="actions">
          <button onClick={() => store.login('Alice')}>Login Alice</button>
          <button onClick={() => store.logout()}>Logout</button>
        </div>
      </div>

      <div className="service-section" style={{ borderLeft: '3px solid var(--color-error, #e53e3e)' }}>
        <h3>Counter fields (flat)</h3>
        <ValueDisplay label="count" value={store.count} />
        <ValueDisplay label="incrementCount" value={store.incrementCount} />
        <ValueDisplay label="doubleCount" value={store.doubleCount} isComputed />
        <ValueDisplay label="isPositive" value={store.isPositive} isComputed />
        <div className="actions">
          <button onClick={() => store.increment()}>+1</button>
          <button onClick={() => store.decrement()}>-1</button>
        </div>
      </div>

      <div className="service-section" style={{ borderLeft: '3px solid var(--color-error, #e53e3e)' }}>
        <h3>Todo fields (flat)</h3>
        <ValueDisplay label="todos" value={JSON.stringify(store.todos)} />
        <ValueDisplay label="lastAdded" value={store.lastAdded ?? '(null)'} />
        <ValueDisplay label="isLoading (shared!)" value={store.isLoading} />
        <ValueDisplay label="totalTodos" value={store.totalTodos} isComputed />
        <ValueDisplay label="hasTodos" value={store.hasTodos} isComputed />
        <div className="actions">
          <button onClick={() => store.addTodo(`Item ${Date.now()}`)}>Add Todo</button>
          <button onClick={() => store.fetchTodos()}>Fetch Todos</button>
        </div>
      </div>

      <div className="service-section cross-lens" style={{ borderLeft: '3px solid #d69e2e' }}>
        <h3>Collision zone</h3>
        <p style={{ fontSize: '0.8em', color: '#d69e2e', margin: '4px 0 8px' }}>
          reset() runs ONLY the Todo service impl. Auth + Counter state is NOT cleared.
        </p>
        <div className="actions">
          <button
            className="collision-demo"
            onClick={() => store.reset()}
          >
            reset() — only Todo resets!
          </button>
        </div>
        <ValueDisplay label="summary" value={store.summary} isComputed />
      </div>
    </StorePanel>
  )
}

// ---- Root component ----

export function DevTest() {
  return (
    <div className="dev-test">
      <DevLensed1Panel />
      <DevLensed2Panel />
      <DevFlatPanel />
    </div>
  )
}
