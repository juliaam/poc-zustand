import { useGlobalStoreA } from '../stores/store-global-a'
import { StorePanel, ValueDisplay } from './StorePanel'

export function GlobalA() {
  const store = useGlobalStoreA()

  return (
    <StorePanel
      title="Global A: Computed Recursivo"
      description="Store global migrado para lenses. Cada service tem seu proprio reset() sem colisao."
    >
      <div className="service-section">
        <h3>Auth (lens)</h3>
        <ValueDisplay label="isAuthenticated" value={store.auth.isAuthenticated} />
        <ValueDisplay label="user" value={store.auth.user ?? '(null)'} />
        <ValueDisplay label="isLoading" value={store.auth.isLoading} />
        <ValueDisplay label="displayName" value={store.auth.displayName} isComputed />
        <div className="actions">
          <button onClick={() => store.auth.login('Alice')}>Login Alice</button>
          <button onClick={() => store.auth.logout()}>Logout</button>
          <button onClick={() => store.auth.reset()}>Reset Auth</button>
        </div>
      </div>

      <div className="service-section">
        <h3>Counter (lens)</h3>
        <ValueDisplay label="count" value={store.counter.count} />
        <ValueDisplay label="doubleCount" value={store.counter.doubleCount} isComputed />
        <ValueDisplay label="isPositive" value={store.counter.isPositive} isComputed />
        <div className="actions">
          <button onClick={() => store.counter.increment()}>+</button>
          <button onClick={() => store.counter.decrement()}>-</button>
          <button onClick={() => store.counter.reset()}>Reset Counter</button>
        </div>
      </div>

      <div className="service-section">
        <h3>Todo (lens)</h3>
        <ValueDisplay label="todos" value={JSON.stringify(store.todo.todos)} />
        <ValueDisplay label="totalTodos" value={store.todo.totalTodos} isComputed />
        <ValueDisplay label="hasTodos" value={store.todo.hasTodos} isComputed />
        <div className="actions">
          <button onClick={() => store.todo.addTodo(`Item ${Date.now()}`)}>Add Todo</button>
          <button onClick={() => store.todo.reset()}>Reset Todos</button>
        </div>
      </div>

      <div className="service-section cross-lens">
        <h3>Cross-Lens Computed</h3>
        <ValueDisplay label="summary" value={store.summary} isComputed />
      </div>
    </StorePanel>
  )
}
