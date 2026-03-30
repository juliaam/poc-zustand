import { create, type StateCreator } from "zustand";
import { withLenses, lens } from "../lib/skyway/lens";
import { computed, compute } from "../lib/skyway/compute";

// ---- Service interfaces ----

export type IAuthService = {
  isAuthenticated: boolean;
  user: string | null;
  isLoading: boolean;
  login: (user: string) => Promise<void>;
  logout: () => void;
  reset: () => void;
  // computed
  displayName: string;
};

export type ICounterService = {
  count: number;
  isLoading: boolean;
  increment: () => void;
  decrement: () => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
  // computed
  doubleCount: number;
  isPositive: boolean;
};

export type ITodoService = {
  todos: string[];
  isLoading: boolean;
  addTodo: (text: string) => void;
  removeTodo: (index: number) => void;
  fetchTodos: () => Promise<void>;
  reset: () => void;
  // computed
  totalTodos: number;
  hasTodos: boolean;
};

// Root store: todo fields live flat at root, auth & counter are lensed
export type DevLensedStore1 = ITodoService & {
  auth: IAuthService;
  counter: ICounterService;
  // cross-lens computed
  summary: string;
};

// Service creator type — mirrors production AppService<T>
export type AppService<T> = StateCreator<DevLensedStore1, [], [], T>;

// ---- Lens service creators ----

const createAuthService = () => ({
  auth: lens<IAuthService, DevLensedStore1>((set, get) => ({
    isAuthenticated: false,
    user: null,
    isLoading: false,
    login: async (user: string) => {
      console.log("[DevLensed1/Auth] login start", user);
      set({ isLoading: true });
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      set({ isAuthenticated: true, user, isLoading: false });
      console.log("[DevLensed1/Auth] login done");
    },
    logout: () => {
      console.log("[DevLensed1/Auth] logout");
      set({ isAuthenticated: false, user: null });
    },
    reset: () => {
      console.log("[DevLensed1/Auth] reset — only auth resets");
      set({ isAuthenticated: false, user: null, isLoading: false });
    },
    ...compute("displayName", get, (s: IAuthService) => ({
      displayName: s.user ?? "Guest",
    })),
  })),
});

const createCounterService: AppService<any> = (setGlobal, get) => ({
  counter: lens<ICounterService, DevLensedStore1>((set, get) => ({
    count: 0,
    isLoading: false,
    increment: () => {
      console.log("[DevLensed1/Counter] increment");
      set({ count: get().count + 1 });
    },
    decrement: () => set({ count: get().count - 1 }),
    setLoading: (loading: boolean) => set({ isLoading: loading }),
    reset: () => {
      console.log("[DevLensed1/Counter] reset — only counter resets");
      set({ count: 0, isLoading: false });
    },
    ...compute("doubleCount", get, (s: ICounterService) => ({
      doubleCount: s.count * 2,
    })),
    ...compute("isPositive", get, (s: ICounterService) => ({
      isPositive: s.count > 0,
    })),
  })),
});

// ---- Flat service creator (not a lens — lives at root level) ----

const createTodoService: AppService<ITodoService> = (set, get) => ({
  todos: [] as string[],
  isLoading: false,
  addTodo: (text: string) => {
    console.log("[DevLensed1/Todo] addTodo", text);
    set({ todos: [...get().todos, text] });
  },
  removeTodo: (index: number) =>
    set({ todos: get().todos.filter((_, i) => i !== index) }),
  fetchTodos: async () => {
    console.log("[DevLensed1/Todo] fetchTodos start");
    set({ isLoading: true });
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    set({ todos: ["Fetched item 1", "Fetched item 2"], isLoading: false });
    console.log("[DevLensed1/Todo] fetchTodos done");
  },
  reset: () => {
    console.log("[DevLensed1/Todo] reset — only todo resets");
    set({ todos: [], isLoading: false });
  },
  ...compute("totalTodos", get, (s: DevLensedStore1) => ({
    totalTodos: s.todos.length,
  })),
  ...compute("hasTodos", get, (s: DevLensedStore1) => ({
    hasTodos: s.todos.length > 0,
  })),
});

// ---- Compose all services ----

export const useDevLensed1 = create<DevLensedStore1>()(
  computed(
    withLenses((set, get, api) => ({
      // Lens-isolated services (each gets scoped set/get)
      ...createAuthService(),
      ...createCounterService(() => set, get, api),
      // Flat service — spread at root (receives root set/get)
      ...createTodoService(set, get, api),
      // Cross-lens computed at root — reads from all services
      ...compute("summary", get, (s: DevLensedStore1) => ({
        summary: `${s.auth.displayName} | count=${s.counter.count} (x2=${s.counter.doubleCount}) | todos=${s.totalTodos}`,
      })),
    })),
  ),
);
