import { create } from 'zustand'
import { withLenses, lens } from '@dhmk/zustand-lens'
import { compute, computedMeta, computedRootMeta } from '../middleware/computed-postprocess'

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

export const useStoreB = create<RootStore>()(
  withLenses((_set, get) => ({
    counter: lens<CounterState>((set, get) => ({
      count: 0,
      isLoading: false,
      increment: () => set({ count: get().count + 1 }),
      decrement: () => set({ count: get().count - 1 }),
      reset: () => {
        console.log('[B/Counter] reset')
        set({ count: 0, isLoading: false })
      },
      // computed markers
      ...(compute('doubleCount', get, (s: CounterState) => ({
        doubleCount: s.count * 2,
      })) as Record<string, unknown>),
      ...(compute('isPositive', get, (s: CounterState) => ({
        isPositive: s.count > 0,
      })) as Record<string, unknown>),
      // Valores iniciais dos computed (postprocess não roda na init)
      doubleCount: 0,
      isPositive: false,
      // OBRIGATÓRIO: incluir meta com postprocess
      ...computedMeta(),
    })),

    todo: lens<TodoState>((set, get) => ({
      todos: [] as string[],
      isLoading: false,
      addTodo: (text: string) => set({ todos: [...get().todos, text] }),
      removeTodo: (index: number) =>
        set({ todos: get().todos.filter((_, i) => i !== index) }),
      reset: () => {
        console.log('[B/Todo] reset')
        set({ todos: [], isLoading: false })
      },
      ...(compute('totalTodos', get, (s: TodoState) => ({
        totalTodos: s.todos.length,
      })) as Record<string, unknown>),
      ...(compute('hasTodos', get, (s: TodoState) => ({
        hasTodos: s.todos.length > 0,
      })) as Record<string, unknown>),
      totalTodos: 0,
      hasTodos: false,
      ...computedMeta(),
    })),

    // cross-lens no root
    ...(compute('summary', get, (s: RootStore) => ({
      summary: `Counter: ${s.counter.count} (x2=${s.counter.doubleCount}) | Todos: ${s.todo.totalTodos} items`,
    })) as Record<string, unknown>),
    summary: '',
    ...computedRootMeta(get),
  })),
)
