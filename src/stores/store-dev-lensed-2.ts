import { create } from 'zustand'
import { withLenses, lens } from '@dhmk/zustand-lens'
import { computed, compute } from '../middleware/computed-recursive'

// ---- Service interfaces ----
// Same colliding names (reset, isLoading) as Store 1, different implementations.
// This store models a "product catalog" variant of the same pattern,
// proving that two independent lensed stores can coexist without interference.

export type IAuthService2 = {
  isAuthenticated: boolean
  user: string | null
  role: 'admin' | 'viewer' | null
  isLoading: boolean
  login: (user: string, role: 'admin' | 'viewer') => Promise<void>
  logout: () => void
  reset: () => void
  // computed
  displayName: string
  isAdmin: boolean
}

export type ICounterService2 = {
  count: number
  step: number
  isLoading: boolean
  increment: () => void
  decrement: () => void
  setStep: (step: number) => void
  reset: () => void
  // computed
  doubleCount: number
  isPositive: boolean
}

export type ITodoService2 = {
  todos: string[]
  filter: 'all' | 'done' | 'pending'
  isLoading: boolean
  addTodo: (text: string) => void
  removeTodo: (index: number) => void
  setFilter: (filter: 'all' | 'done' | 'pending') => void
  fetchTodos: () => Promise<void>
  reset: () => void
  // computed
  totalTodos: number
  hasTodos: boolean
}

export type DevLensedStore2 = {
  auth: IAuthService2
  counter: ICounterService2
  todo: ITodoService2
  // cross-lens computed
  summary: string
}

export const useDevLensed2 = create<DevLensedStore2>()(
  computed(
    withLenses((_set, get) => ({
      auth: lens<IAuthService2>((set, get) => ({
        isAuthenticated: false,
        user: null,
        role: null,
        isLoading: false,
        login: async (user: string, role: 'admin' | 'viewer') => {
          console.log('[DevLensed2/Auth] login start', user, role)
          set({ isLoading: true })
          await new Promise<void>((resolve) => setTimeout(resolve, 50))
          set({ isAuthenticated: true, user, role, isLoading: false })
          console.log('[DevLensed2/Auth] login done')
        },
        logout: () => {
          console.log('[DevLensed2/Auth] logout')
          set({ isAuthenticated: false, user: null, role: null })
        },
        reset: () => {
          console.log('[DevLensed2/Auth] reset — only auth resets')
          set({ isAuthenticated: false, user: null, role: null, isLoading: false })
        },
        ...compute('displayName', get, (s: IAuthService2) => ({
          displayName: s.user ? `${s.user} (${s.role ?? 'no role'})` : 'Guest',
        })),
        ...compute('isAdmin', get, (s: IAuthService2) => ({
          isAdmin: s.role === 'admin',
        })),
      })),

      counter: lens<ICounterService2>((set, get) => ({
        count: 0,
        step: 1,
        isLoading: false,
        increment: () => {
          console.log('[DevLensed2/Counter] increment by step', get().step)
          set({ count: get().count + get().step })
        },
        decrement: () => set({ count: get().count - get().step }),
        setStep: (step: number) => set({ step }),
        reset: () => {
          console.log('[DevLensed2/Counter] reset — only counter resets')
          set({ count: 0, step: 1, isLoading: false })
        },
        ...compute('doubleCount', get, (s: ICounterService2) => ({
          doubleCount: s.count * 2,
        })),
        ...compute('isPositive', get, (s: ICounterService2) => ({
          isPositive: s.count > 0,
        })),
      })),

      todo: lens<ITodoService2>((set, get) => ({
        todos: [] as string[],
        filter: 'all' as const,
        isLoading: false,
        addTodo: (text: string) => {
          console.log('[DevLensed2/Todo] addTodo', text)
          set({ todos: [...get().todos, text] })
        },
        removeTodo: (index: number) =>
          set({ todos: get().todos.filter((_, i) => i !== index) }),
        setFilter: (filter: 'all' | 'done' | 'pending') => {
          console.log('[DevLensed2/Todo] setFilter', filter)
          set({ filter })
        },
        fetchTodos: async () => {
          console.log('[DevLensed2/Todo] fetchTodos start')
          set({ isLoading: true })
          await new Promise<void>((resolve) => setTimeout(resolve, 50))
          set({ todos: ['Fetched A', 'Fetched B', 'Fetched C'], isLoading: false })
          console.log('[DevLensed2/Todo] fetchTodos done')
        },
        reset: () => {
          console.log('[DevLensed2/Todo] reset — only todo resets')
          set({ todos: [], filter: 'all', isLoading: false })
        },
        ...compute('totalTodos', get, (s: ITodoService2) => ({
          totalTodos: s.todos.length,
        })),
        ...compute('hasTodos', get, (s: ITodoService2) => ({
          hasTodos: s.todos.length > 0,
        })),
      })),

      // cross-lens computed — role-aware summary
      ...compute('summary', get, (s: DevLensedStore2) => ({
        summary: `[${s.auth.isAdmin ? 'ADMIN' : 'viewer'}] ${s.auth.displayName} | step=${s.counter.step} count=${s.counter.count} | todos=${s.todo.totalTodos} filter=${s.todo.filter}`,
      })),
    })),
  ),
)
