import { useFlatStore } from '../stores/store-flat'
import { StorePanel, ValueDisplay } from './StorePanel'

export function FlatBaseline() {
  const store = useFlatStore()

  return (
    <StorePanel
      title="Flat Baseline"
      description="Store flat com computed original. Demonstra colisão de nomes: reset() e isLoading existem em AMBOS os services — o último spread vence."
    >
      <div className="service-section">
        <h3>Counter</h3>
        <ValueDisplay label="count" value={store.count} />
        <ValueDisplay label="isLoading" value={store.isLoading} />
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
          <button onClick={() => store.addTodo(`Item ${Date.now()}`)}>
            Add Todo
          </button>
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
