import { create } from 'zustand'
import { withLenses } from '@dhmk/zustand-lens'
import { computedLens, compute, computeRoot } from '../middleware/computed-lens-factory'

type CounterState = {
  count: number
  isLoading: boolean
  increment: () => void
  decrement: () => void
  reset: () => void
  doubleCount: number
  isPositive: boolean
}

type TodoState = {
  todos: string[]
  isLoading: boolean
  addTodo: (text: string) => void
  removeTodo: (index: number) => void
  reset: () => void
  totalTodos: number
  hasTodos: boolean
}

type RootStore = {
  counter: CounterState
  todo: TodoState
  summary: string
}

export const useStoreC = create<RootStore>()(
  withLenses((_set, get) => ({
    // computedLens substitui lens — API mais limpa
    counter: computedLens<CounterState>((set, get) => ({
      count: 0,
      isLoading: false,
      increment: () => set({ count: get().count + 1 }),
      decrement: () => set({ count: get().count - 1 }),
      reset: () => {
        console.log('[C/Counter] reset')
        set({ count: 0, isLoading: false })
      },
      ...compute('doubleCount', get, (s: CounterState) => ({
        doubleCount: s.count * 2,
      })),
      ...compute('isPositive', get, (s: CounterState) => ({
        isPositive: s.count > 0,
      })),
    })),

    todo: computedLens<TodoState>((set, get) => ({
      todos: [] as string[],
      isLoading: false,
      addTodo: (text: string) => set({ todos: [...get().todos, text] }),
      removeTodo: (index: number) =>
        set({ todos: get().todos.filter((_, i) => i !== index) }),
      reset: () => {
        console.log('[C/Todo] reset')
        set({ todos: [], isLoading: false })
      },
      ...compute('totalTodos', get, (s: TodoState) => ({
        totalTodos: s.todos.length,
      })),
      ...compute('hasTodos', get, (s: TodoState) => ({
        hasTodos: s.todos.length > 0,
      })),
    })),

    // cross-lens no root
    summary: '',
    ...computeRoot('summary', get, (s: RootStore) => ({
      summary: `Counter: ${s.counter.count} (x2=${s.counter.doubleCount}) | Todos: ${s.todo.totalTodos} items`,
    })),
  })),
)
