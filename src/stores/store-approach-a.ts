import { create } from "zustand";
import { withLenses, lens } from "@dhmk/zustand-lens";
import { computed, compute } from "../middleware/computed-recursive";

// ---- Types ----
type CounterState = {
  count: number;
  isLoading: boolean;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  doubleCount: number;
  isPositive: boolean;
  isNegative: boolean;
};

type TodoState = {
  todos: string[];
  isLoading: boolean;
  addTodo: (text: string) => void;
  removeTodo: (index: number) => void;
  reset: () => void;
  totalTodos: number;
  hasTodos: boolean;
};

type RootStore = {
  summaryTeste: string;
  counter: CounterState;
  todo: TodoState;
  summary: string;
  value: number;
  account: boolean;
  outraCoisa: string;
  isPositiveAndHasTodos: boolean;
};

export const useStoreA = create<RootStore>()(
  computed(
    withLenses((_set, get) => ({
      counter: lens<CounterState>((set, get) => ({
        count: 0,
        isLoading: false,
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 }),
        reset: () => {
          console.log("[A/Counter] reset");
          set({ count: 0, isLoading: false });
        },
        // computed LOCAL — recebe estado do lens (CounterState)
        ...compute("doubleCount", get, (s: CounterState) => ({
          doubleCount: s.count * 2,
        })),
        ...compute("isPositive", get, (s: CounterState) => ({
          isPositive: s.count > 0,
        })),
        ...compute(get, (s) => ({
          isNegative: s.count < 0,
        })),
      })),

      todo: lens<TodoState>((set, get) => ({
        todos: [] as string[],
        isLoading: false,
        addTodo: (text: string) => set({ todos: [...get().todos, text] }),
        removeTodo: (index: number) =>
          set({ todos: get().todos.filter((_, i) => i !== index) }),
        reset: () => {
          console.log("[A/Todo] reset");
          set({ todos: [], isLoading: false });
        },
        // computed LOCAL
        ...compute("totalTodos", get, (s: TodoState) => ({
          totalTodos: s.todos.length,
        })),
        ...compute("hasTodos", get, (s: TodoState) => ({
          hasTodos: s.todos.length > 0,
        })),
      })),

      account: true,
      value: 2,
      summaryTeste: "como tudo deve ser",
      // computed CROSS-LENS no nível raiz — recebe RootStore inteira
      ...compute("summary", get, (s: RootStore) => ({
        summary: `Counter: ${s.counter.count} (x2=${s.counter.doubleCount}) | Todos: ${s.todo.totalTodos} items`,
      })),
      ...compute(get, (s) => ({
        outraCoisa: s.counter.isNegative ? "negativo" : "nao negativo",
        isPositiveAndHasTodos: s.counter.isPositive && s.todo.hasTodos,
      })),
    })),
  ),
);
