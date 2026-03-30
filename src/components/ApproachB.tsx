import { useStoreB } from "../stores/store-approach-b";
import { StorePanel, ValueDisplay } from "./StorePanel";

export function ApproachB() {
  const store = useStoreB();

  return (
    <StorePanel
      title="Abordagem B: meta.postprocess"
      description="Usa [meta].postprocess do zustand-lens para aplicar computed em cada lens. Requer valores iniciais manuais."
    >
      <div className="service-section">
        <h3>Counter (lens)</h3>
        <ValueDisplay label="count" value={store.counter.count} />
        <ValueDisplay label="isLoading" value={store.counter.isLoading} />
        <ValueDisplay
          label="doubleCount"
          value={store.counter.doubleCount}
          isComputed
        />
        <ValueDisplay
          label="isPositive"
          value={store.counter.isPositive}
          isComputed
        />
        <div className="actions">
          <button onClick={() => store.counter.increment()}>+</button>
          <button onClick={() => store.counter.decrement()}>-</button>
          <button onClick={() => store.counter.reset()}>Reset Counter</button>
        </div>
      </div>

      <div className="service-section">
        <h3>Todo (lens)</h3>
        <ValueDisplay label="todos" value={JSON.stringify(store.todo.todos)} />
        <ValueDisplay label="isLoading" value={store.todo.isLoading} />
        <ValueDisplay
          label="totalTodos"
          value={store.todo.totalTodos}
          isComputed
        />
        <ValueDisplay label="hasTodos" value={store.todo.hasTodos} isComputed />
        <div className="actions">
          <button onClick={() => store.todo.addTodo(`Item ${Date.now()}`)}>
            Add Todo
          </button>
          <button onClick={() => store.todo.reset()}>Reset Todos</button>
        </div>
      </div>

      <div className="service-section cross-lens">
        <h3>Cross-Lens Computed</h3>
        <ValueDisplay label="summary" value={store.summary} isComputed />
      </div>
    </StorePanel>
  );
}
