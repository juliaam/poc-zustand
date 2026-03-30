import { useGlobalFlatStore } from '../stores/store-global-flat'
import { StorePanel, ValueDisplay } from './StorePanel'

export function GlobalFlat() {
  const store = useGlobalFlatStore()

  return (
    <StorePanel
      title="Global Flat (Padrao Real)"
      description="Espelha o useApp real: multiplos services com CombinedServices + GlobalService<T>. Colisoes de reset() e isLoading sao demonstradas."
    >
      <div className="service-section">
        <h3>Auth</h3>
        <ValueDisplay label="isAuthenticated" value={store.isAuthenticated} />
        <ValueDisplay label="user" value={store.user ?? '(null)'} />
        <ValueDisplay label="isLoading" value={store.isLoading} />
        <ValueDisplay label="displayName" value={store.displayName} isComputed />
        <div className="actions">
          <button onClick={() => store.login('Alice')}>Login Alice</button>
          <button onClick={() => store.logout()}>Logout</button>
        </div>
      </div>

      <div className="service-section">
        <h3>Counter</h3>
        <ValueDisplay label="count" value={store.count} />
        <ValueDisplay label="doubleCount" value={store.doubleCount} isComputed />
        <ValueDisplay label="isPositive" value={store.isPositive} isComputed />
        <div className="actions">
          <button onClick={() => store.increment()}>+</button>
          <button onClick={() => store.decrement()}>-</button>
        </div>
      </div>

      <div className="service-section">
        <h3>Todo</h3>
        <ValueDisplay label="todos" value={JSON.stringify(store.todos)} />
        <ValueDisplay label="totalTodos" value={store.totalTodos} isComputed />
        <ValueDisplay label="hasTodos" value={store.hasTodos} isComputed />
        <div className="actions">
          <button onClick={() => store.addTodo(`Item ${Date.now()}`)}>Add Todo</button>
        </div>
      </div>

      <div className="service-section cross-lens">
        <h3>Cross-Service Computed</h3>
        <ValueDisplay label="summary" value={store.summary} isComputed />
        <div className="actions collision-demo">
          <button onClick={() => store.reset()}>
            reset() — chama QUAL service? (ultimo spread vence)
          </button>
        </div>
      </div>
    </StorePanel>
  )
}
