import { create, type StateCreator } from 'zustand'
import { computed, compute } from '../middleware/computed-original'

// ---- Counter Service ----
type CounterSlice = {
  count: number
  isLoading: boolean
  increment: () => void
  decrement: () => void
  reset: () => void
  // computed
  doubleCount: number
  isPositive: boolean
}

// ---- Todo Service ----
type TodoSlice = {
  todos: string[]
  isLoading: boolean
  addTodo: (text: string) => void
  removeTodo: (index: number) => void
  reset: () => void
  // computed
  totalTodos: number
  hasTodos: boolean
}

// PROBLEMA: reset() e isLoading colidem!
// O TypeScript pode não reclamar se os tipos forem compatíveis,
// mas o ÚLTIMO spread vence — o comportamento de reset() do
// TodoService sobrescreve o do CounterService.
type FlatStore = CounterSlice & TodoSlice & {
  summary: string
}

type FlatService<T> = StateCreator<FlatStore, [], [], T>

const createCounterService: FlatService<CounterSlice> = (set, get) => ({
  count: 0,
  isLoading: false,
  increment: () => {
    console.log('[Counter] increment')
    set({ count: get().count + 1 })
  },
  decrement: () => set({ count: get().count - 1 }),
  reset: () => {
    console.log('[Counter] reset chamado')
    set({ count: 0, isLoading: false })
  },
  ...compute('counterDouble', get, (s: FlatStore) => ({
    doubleCount: s.count * 2,
  })),
  ...compute('counterPositive', get, (s: FlatStore) => ({
    isPositive: s.count > 0,
  })),
})

const createTodoService: FlatService<TodoSlice> = (set, get) => ({
  todos: [] as string[],
  isLoading: false,
  addTodo: (text: string) => set({ todos: [...get().todos, text] }),
  removeTodo: (index: number) =>
    set({ todos: get().todos.filter((_, i) => i !== index) }),
  reset: () => {
    console.log('[Todo] reset chamado — ESTE sobrescreve o Counter.reset!')
    set({ todos: [], isLoading: false })
  },
  ...compute('todoTotal', get, (s: FlatStore) => ({
    totalTodos: s.todos.length,
  })),
  ...compute('todoHas', get, (s: FlatStore) => ({
    hasTodos: s.todos.length > 0,
  })),
})

export const useFlatStore = create<FlatStore>()(
  computed((...a) => ({
    ...createCounterService(...a),
    ...createTodoService(...a),
    // cross-service computed
    ...compute('summary', a[1], (s: FlatStore) => ({
      summary: `Counter: ${s.count} (x2=${s.doubleCount}) | Todos: ${s.totalTodos} items`,
    })),
  })),
)
