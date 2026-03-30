import { create, type StateCreator } from 'zustand'
import { computed, compute } from '../middleware/computed-original'

// ---- Interfaces ----
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

// Intersecção — espelha CombinedAppServices
type CombinedServices = IAuthService & ICounterService & ITodoService & {
  summary: string
}

// Helper — espelha AppService<T>
type GlobalService<T> = StateCreator<CombinedServices, [], [], T>

// ---- Service Creators ----
const createAuthService: GlobalService<IAuthService> = (set, get) => ({
  isAuthenticated: false,
  user: null,
  isLoading: false,
  login: (user: string) => {
    console.log('[Global/Auth] login', user)
    set({ isAuthenticated: true, user, isLoading: false })
  },
  logout: () => {
    console.log('[Global/Auth] logout')
    set({ isAuthenticated: false, user: null })
  },
  reset: () => {
    console.log('[Global/Auth] reset')
    set({ isAuthenticated: false, user: null, isLoading: false })
  },
  ...compute('displayName', get, (s: CombinedServices) => ({
    displayName: s.user ?? 'Guest',
  })),
})

const createCounterService: GlobalService<ICounterService> = (set, get) => ({
  count: 0,
  isLoading: false,
  increment: () => {
    console.log('[Global/Counter] increment')
    set({ count: get().count + 1 })
  },
  decrement: () => set({ count: get().count - 1 }),
  reset: () => {
    // COLISÃO: este reset() sobrescreve o de AuthService
    console.log('[Global/Counter] reset — sobrescreve Auth.reset!')
    set({ count: 0, isLoading: false })
  },
  ...compute('doubleCount', get, (s: CombinedServices) => ({
    doubleCount: s.count * 2,
  })),
  ...compute('isPositive', get, (s: CombinedServices) => ({
    isPositive: s.count > 0,
  })),
})

const createTodoService: GlobalService<ITodoService> = (set, get) => ({
  todos: [] as string[],
  isLoading: false,
  addTodo: (text: string) => set({ todos: [...get().todos, text] }),
  removeTodo: (index: number) =>
    set({ todos: get().todos.filter((_, i) => i !== index) }),
  reset: () => {
    // COLISÃO: este reset() sobrescreve Counter.reset e Auth.reset
    console.log('[Global/Todo] reset — ESTE vence (último spread)!')
    set({ todos: [], isLoading: false })
  },
  ...compute('totalTodos', get, (s: CombinedServices) => ({
    totalTodos: s.todos.length,
  })),
  ...compute('hasTodos', get, (s: CombinedServices) => ({
    hasTodos: s.todos.length > 0,
  })),
})

// Store global — espelha useApp do projeto real
export const useGlobalFlatStore = create<CombinedServices>()(
  computed((...a) => ({
    ...createAuthService(...a),
    ...createCounterService(...a),
    ...createTodoService(...a),
    // cross-service computed
    ...compute('summary', a[1], (s: CombinedServices) => ({
      summary: `Auth: ${s.displayName} | Counter: ${s.count} (x2=${s.doubleCount}) | Todos: ${s.totalTodos}`,
    })),
  })),
)
