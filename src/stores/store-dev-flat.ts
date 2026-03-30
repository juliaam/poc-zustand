import { create, type StateCreator } from 'zustand'
import { computed, compute } from '../middleware/computed-original'

// ---- Service interfaces ----
// Flat spread — same collision problems as the real useApp before migration.
// reset() and isLoading are defined in all 3 services; the LAST spread wins.

export type IAuthSlice = {
  isAuthenticated: boolean
  user: string | null
  isLoading: boolean
  login: (user: string) => Promise<void>
  logout: () => void
  reset: () => void   // COLLIDES with Counter and Todo
  // computed
  displayName: string
  // non-colliding — unique to auth
  sessionToken: string | null
}

export type ICounterSlice = {
  count: number
  isLoading: boolean
  increment: () => void
  decrement: () => void
  reset: () => void   // COLLIDES with Auth and Todo
  // computed
  doubleCount: number
  isPositive: boolean
  // non-colliding — unique to counter
  incrementCount: number
}

export type ITodoSlice = {
  todos: string[]
  isLoading: boolean
  addTodo: (text: string) => void
  removeTodo: (index: number) => void
  fetchTodos: () => Promise<void>
  reset: () => void   // COLLIDES — this is the one that survives (last spread)
  // computed
  totalTodos: number
  hasTodos: boolean
  // non-colliding — unique to todo
  lastAdded: string | null
}

// Full flat intersection — mimics CombinedAppServices in the real app
export type DevFlatStore = IAuthSlice & ICounterSlice & ITodoSlice & {
  summary: string
}

type FlatService<T> = StateCreator<DevFlatStore, [], [], T>

// ---- Service creators ----

const createAuthService: FlatService<IAuthSlice> = (set, get) => ({
  isAuthenticated: false,
  user: null,
  isLoading: false,
  sessionToken: null,
  login: async (user: string) => {
    console.log('[DevFlat/Auth] login start', user)
    set({ isLoading: true })
    await new Promise<void>((resolve) => setTimeout(resolve, 50))
    set({ isAuthenticated: true, user, isLoading: false, sessionToken: `tok_${user}` })
    console.log('[DevFlat/Auth] login done')
  },
  logout: () => {
    console.log('[DevFlat/Auth] logout')
    set({ isAuthenticated: false, user: null, sessionToken: null })
  },
  reset: () => {
    // This reset WILL BE overwritten by Counter's and Todo's reset (spread order)
    console.log('[DevFlat/Auth] reset — will be overwritten!')
    set({ isAuthenticated: false, user: null, isLoading: false, sessionToken: null })
  },
  ...compute('displayName', get, (s: DevFlatStore) => ({
    displayName: s.user ?? 'Guest',
  })),
})

const createCounterService: FlatService<ICounterSlice> = (set, get) => ({
  count: 0,
  isLoading: false,
  incrementCount: 0,
  increment: () => {
    console.log('[DevFlat/Counter] increment')
    set({ count: get().count + 1, incrementCount: get().incrementCount + 1 })
  },
  decrement: () => set({ count: get().count - 1 }),
  reset: () => {
    // This reset WILL BE overwritten by Todo's reset (spread order)
    console.log('[DevFlat/Counter] reset — will be overwritten!')
    set({ count: 0, isLoading: false, incrementCount: 0 })
  },
  ...compute('doubleCount', get, (s: DevFlatStore) => ({
    doubleCount: s.count * 2,
  })),
  ...compute('isPositive', get, (s: DevFlatStore) => ({
    isPositive: s.count > 0,
  })),
})

const createTodoService: FlatService<ITodoSlice> = (set, get) => ({
  todos: [] as string[],
  isLoading: false,
  lastAdded: null,
  addTodo: (text: string) => {
    console.log('[DevFlat/Todo] addTodo', text)
    set({ todos: [...get().todos, text], lastAdded: text })
  },
  removeTodo: (index: number) =>
    set({ todos: get().todos.filter((_, i) => i !== index) }),
  fetchTodos: async () => {
    console.log('[DevFlat/Todo] fetchTodos start')
    set({ isLoading: true })
    await new Promise<void>((resolve) => setTimeout(resolve, 50))
    set({ todos: ['Fetched item 1', 'Fetched item 2'], isLoading: false })
    console.log('[DevFlat/Todo] fetchTodos done')
  },
  reset: () => {
    // This reset WINS — it is spread last and overwrites Auth's and Counter's
    console.log('[DevFlat/Todo] reset — WINS (last spread)')
    set({ todos: [], isLoading: false, lastAdded: null })
  },
  ...compute('totalTodos', get, (s: DevFlatStore) => ({
    totalTodos: s.todos.length,
  })),
  ...compute('hasTodos', get, (s: DevFlatStore) => ({
    hasTodos: s.todos.length > 0,
  })),
})

export const useDevFlat = create<DevFlatStore>()(
  computed((...a) => ({
    ...createAuthService(...a),
    ...createCounterService(...a),
    ...createTodoService(...a),
    ...compute('summary', a[1], (s: DevFlatStore) => ({
      summary: `${s.displayName} | count=${s.count} (x2=${s.doubleCount}) | todos=${s.totalTodos}`,
    })),
  })),
)
