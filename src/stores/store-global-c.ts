import { create } from 'zustand'
import { withLenses } from '@dhmk/zustand-lens'
import { computedLens, compute, computeRoot } from '../middleware/computed-lens-factory'

type IAuthService = {
  isAuthenticated: boolean
  user: string | null
  isLoading: boolean
  login: (user: string) => void
  logout: () => void
  reset: () => void
  displayName: string
}

type ICounterService = {
  count: number
  isLoading: boolean
  increment: () => void
  decrement: () => void
  reset: () => void
  doubleCount: number
  isPositive: boolean
}

type ITodoService = {
  todos: string[]
  isLoading: boolean
  addTodo: (text: string) => void
  removeTodo: (index: number) => void
  reset: () => void
  totalTodos: number
  hasTodos: boolean
}

type GlobalRootStore = {
  auth: IAuthService
  counter: ICounterService
  todo: ITodoService
  summary: string
}

export const useGlobalStoreC = create<GlobalRootStore>()(
  withLenses((_set, get) => ({
    auth: computedLens<IAuthService>((set, get) => ({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      login: (user: string) => set({ isAuthenticated: true, user }),
      logout: () => set({ isAuthenticated: false, user: null }),
      reset: () => set({ isAuthenticated: false, user: null, isLoading: false }),
      ...compute('displayName', get, (s: IAuthService) => ({
        displayName: s.user ?? 'Guest',
      })),
    })),

    counter: computedLens<ICounterService>((set, get) => ({
      count: 0,
      isLoading: false,
      increment: () => set({ count: get().count + 1 }),
      decrement: () => set({ count: get().count - 1 }),
      reset: () => set({ count: 0, isLoading: false }),
      ...compute('doubleCount', get, (s: ICounterService) => ({
        doubleCount: s.count * 2,
      })),
      ...compute('isPositive', get, (s: ICounterService) => ({
        isPositive: s.count > 0,
      })),
    })),

    todo: computedLens<ITodoService>((set, get) => ({
      todos: [] as string[],
      isLoading: false,
      addTodo: (text: string) => set({ todos: [...get().todos, text] }),
      removeTodo: (index: number) =>
        set({ todos: get().todos.filter((_, i) => i !== index) }),
      reset: () => set({ todos: [], isLoading: false }),
      ...compute('totalTodos', get, (s: ITodoService) => ({
        totalTodos: s.todos.length,
      })),
      ...compute('hasTodos', get, (s: ITodoService) => ({
        hasTodos: s.todos.length > 0,
      })),
    })),

    summary: '',
    ...computeRoot('summary', get, (s: GlobalRootStore) => ({
      summary: `Auth: ${s.auth.displayName} | Counter: ${s.counter.count} (x2=${s.counter.doubleCount}) | Todos: ${s.todo.totalTodos}`,
    })),
  })),
)
