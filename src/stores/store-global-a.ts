import { create } from 'zustand'
import { withLenses, lens } from '@dhmk/zustand-lens'
import { computed, compute } from '../middleware/computed-recursive'

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

export const useGlobalStoreA = create<GlobalRootStore>()(
  computed(
    withLenses((_set, get) => ({
      auth: lens<IAuthService>((set, get) => ({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        login: (user: string) => {
          console.log('[GlobalA/Auth] login', user)
          set({ isAuthenticated: true, user, isLoading: false })
        },
        logout: () => set({ isAuthenticated: false, user: null }),
        reset: () => set({ isAuthenticated: false, user: null, isLoading: false }),
        ...compute('displayName', get, (s: IAuthService) => ({
          displayName: s.user ?? 'Guest',
        })),
      })),

      counter: lens<ICounterService>((set, get) => ({
        count: 0,
        isLoading: false,
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 }),
        reset: () => {
          console.log('[GlobalA/Counter] reset — sem colisão!')
          set({ count: 0, isLoading: false })
        },
        ...compute('doubleCount', get, (s: ICounterService) => ({
          doubleCount: s.count * 2,
        })),
        ...compute('isPositive', get, (s: ICounterService) => ({
          isPositive: s.count > 0,
        })),
      })),

      todo: lens<ITodoService>((set, get) => ({
        todos: [] as string[],
        isLoading: false,
        addTodo: (text: string) => set({ todos: [...get().todos, text] }),
        removeTodo: (index: number) =>
          set({ todos: get().todos.filter((_, i) => i !== index) }),
        reset: () => {
          console.log('[GlobalA/Todo] reset — sem colisão!')
          set({ todos: [], isLoading: false })
        },
        ...compute('totalTodos', get, (s: ITodoService) => ({
          totalTodos: s.todos.length,
        })),
        ...compute('hasTodos', get, (s: ITodoService) => ({
          hasTodos: s.todos.length > 0,
        })),
      })),

      // cross-lens computed no root
      ...compute('summary', get, (s: GlobalRootStore) => ({
        summary: `Auth: ${s.auth.displayName} | Counter: ${s.counter.count} (x2=${s.counter.doubleCount}) | Todos: ${s.todo.totalTodos}`,
      })),
    })),
  ),
)
