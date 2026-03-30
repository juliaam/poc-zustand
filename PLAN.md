# POC: zustand-computed-state + @dhmk/zustand-lens

## Objetivo

Testar compatibilidade entre o middleware `computed` customizado (baseado em zustand-computed-state) e o `@dhmk/zustand-lens`, resolvendo o problema de colisão de nomes em stores "planas".

---

## Problema Identificado

O middleware `computed` busca chaves `$$_computed_*` apenas no **nível raiz** do estado via `Object.entries(state)`. Quando usado com `withLenses`, as chaves computed ficam **aninhadas** dentro dos slices dos lenses (ex: `state.auth.$$_computed_isAdmin`), e nunca são encontradas.

**Fluxo do problema:**
1. Lens chama `set({count: 1})`
2. `createLens._set` wrapa em `setIn(parentState, path, newValue)` → chama parent `set`
3. Parent `set` chega em `setWithComputed`
4. `setWithComputed` faz `Object.entries(newState)` → só vê keys raiz (`counter`, `todo`)
5. Computed functions dentro dos lenses **nunca são executadas**

---

## Estrutura do Projeto

```
src/
  middleware/
    computed-original.ts         # Computed original (referência, usado no baseline)
    computed-recursive.ts        # Abordagem A: computed recursivo
    computed-postprocess.ts      # Abordagem B: helpers para meta.postprocess
    computed-lens-factory.ts     # Abordagem C: factory computedLens
  stores/
    store-flat.ts                # Baseline flat (demonstra colisão de nomes)
    store-approach-a.ts          # withLenses + computed recursivo
    store-approach-b.ts          # withLenses + meta.postprocess
    store-approach-c.ts          # withLenses + computedLens factory
  components/
    StorePanel.tsx               # Componente reutilizável para visualizar estado
    FlatBaseline.tsx             # UI do baseline
    ApproachA.tsx                # UI da abordagem A
    ApproachB.tsx                # UI da abordagem B
    ApproachC.tsx                # UI da abordagem C
  App.tsx                        # Tabs para alternar entre abordagens
  App.css                        # Estilos
  main.tsx
```

---

## Dependências

Já instaladas:
- `zustand` (5.0.12)
- `@dhmk/zustand-lens` (5.0.0)

---

## Services de Teste

Dois services com **nomes propositalmente colidindo** para demonstrar o problema:

### CounterService
- Estado: `count: number`, `isLoading: boolean`
- Ações: `increment()`, `decrement()`, `reset()`
- Computed local: `doubleCount` (count * 2), `isPositive` (count > 0)

### TodoService
- Estado: `todos: string[]`, `isLoading: boolean`
- Ações: `addTodo(text)`, `removeTodo(index)`, `reset()`
- Computed local: `totalTodos` (todos.length), `hasTodos` (todos.length > 0)

### Cross-lens Computed (nível raiz)
- `summary`: string combinando dados de counter + todo (ex: `"3 items, count=5"`)

**Colisão de nomes:** `reset()` e `isLoading` existem em AMBOS os services.

---

## Implementação por Arquivo

### 1. `src/middleware/computed-original.ts`

O computed original, sem modificações. Usado no store flat baseline.

```ts
import type { StateCreator, StoreMutatorIdentifier } from 'zustand';

const prefix = '$$_computed';
let prefixCounter = 0;

function injectComputedMiddleware(f: StateCreator<any>): StateCreator<any> {
  return (set, get, api) => {
    function applyComputedState(state: any) {
      const computedFunctions = Object.entries(state)
        .filter(s => s[0].startsWith(prefix))
        .map(s => s[1] as ComputeFunctionType<any, any>);
      const computedSt = computedFunctions.reduce(
        (acc, cur) => Object.assign(acc, cur(acc)),
        state,
      );
      return computedSt;
    }

    function setWithComputed(
      update: any | ((state: any) => any),
      replace?: boolean,
    ) {
      set((state: any) => {
        const updated = typeof update === 'function' ? update(state) : update;
        const newState = Object.assign({}, state, updated);
        return applyComputedState(newState);
      }, replace as any);
    }

    api.setState = setWithComputed;
    const st = f(setWithComputed, get, api);
    return applyComputedState(st);
  };
}

type ComputeFunctionType<StoreType, T> = (store: StoreType) => T;

export function compute<StoreType, T extends Partial<StoreType>>(
  id: string,
  get: () => StoreType,
  compute: ComputeFunctionType<StoreType, T>,
): T;

export function compute<StoreType, T extends Partial<StoreType>>(
  get: () => StoreType,
  compute: ComputeFunctionType<StoreType, T>,
  other?: never,
): T;

export function compute(
  getOrId: any,
  getOrCompute: any,
  computeOrUndefined: any,
) {
  if (typeof getOrId === 'string') {
    return {
      [`${prefix}_${getOrId}`]: computeOrUndefined,
    };
  }
  return {
    [`${prefix}_${prefixCounter++}`]: getOrCompute,
  };
}

type ComputedState = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  f: StateCreator<T, Mps, Mcs>,
) => StateCreator<T, Mps, Mcs>;

export const computed = ((f: any) =>
  injectComputedMiddleware(f)) as unknown as ComputedState;
```

---

### 2. `src/middleware/computed-recursive.ts` — Abordagem A

Diferença principal: `applyComputedState` agora percorre recursivamente objetos aninhados.

```ts
import type { StateCreator, StoreMutatorIdentifier } from 'zustand';

const prefix = '$$_computed';
let prefixCounter = 0;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function applyComputedState(state: any): any {
  const processed = { ...state };

  // 1. Recursivamente processar objetos aninhados (os slices dos lenses)
  for (const [key, value] of Object.entries(processed)) {
    if (isPlainObject(value) && !key.startsWith(prefix)) {
      processed[key] = applyComputedState(value);
    }
  }

  // 2. Aplicar computed functions do nível atual
  const computedFunctions = Object.entries(processed)
    .filter(([k]) => k.startsWith(prefix))
    .map(([, v]) => v as (state: any) => any);

  return computedFunctions.reduce(
    (acc, fn) => Object.assign(acc, fn(acc)),
    processed,
  );
}

function injectComputedMiddleware(f: StateCreator<any>): StateCreator<any> {
  return (set, get, api) => {
    function setWithComputed(
      update: any | ((state: any) => any),
      replace?: boolean,
    ) {
      set((state: any) => {
        const updated = typeof update === 'function' ? update(state) : update;
        const newState = Object.assign({}, state, updated);
        return applyComputedState(newState);
      }, replace as any);
    }

    api.setState = setWithComputed;
    const st = f(setWithComputed, get, api);
    return applyComputedState(st);
  };
}

type ComputeFunctionType<StoreType, T> = (store: StoreType) => T;

// Mesma API de compute que o original
export function compute<StoreType, T extends Partial<StoreType>>(
  id: string,
  get: () => StoreType,
  compute: ComputeFunctionType<StoreType, T>,
): T;
export function compute<StoreType, T extends Partial<StoreType>>(
  get: () => StoreType,
  compute: ComputeFunctionType<StoreType, T>,
  other?: never,
): T;
export function compute(
  getOrId: any,
  getOrCompute: any,
  computeOrUndefined: any,
) {
  if (typeof getOrId === 'string') {
    return { [`${prefix}_${getOrId}`]: computeOrUndefined };
  }
  return { [`${prefix}_${prefixCounter++}`]: getOrCompute };
}

type ComputedState = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  f: StateCreator<T, Mps, Mcs>,
) => StateCreator<T, Mps, Mcs>;

export const computed = ((f: any) =>
  injectComputedMiddleware(f)) as unknown as ComputedState;
```

**Pontos de atenção:**
- A recursão percorre TODA a árvore a cada `set`. Para a POC é ok, em produção pode ser necessário otimizar.
- A ordem importa: primeiro processa filhos (lenses), depois aplica computed do nível atual. Isso garante que computed cross-lens no root veja os valores computed dos filhos já calculados.
- Computed local (dentro de um lens) recebe o estado LOCAL do lens como argumento, não o estado global. Isso é o comportamento esperado.

---

### 3. `src/middleware/computed-postprocess.ts` — Abordagem B

Usa `[meta].postprocess` do zustand-lens para aplicar computed em cada lens.

```ts
import { meta } from '@dhmk/zustand-lens';

const prefix = '$$_computed';
let prefixCounter = 0;

type ComputeFunctionType<StoreType, T> = (store: StoreType) => T;

// Mesma API de compute
export function compute<StoreType, T extends Partial<StoreType>>(
  id: string,
  get: () => StoreType,
  compute: ComputeFunctionType<StoreType, T>,
): T;
export function compute<StoreType, T extends Partial<StoreType>>(
  get: () => StoreType,
  compute: ComputeFunctionType<StoreType, T>,
  other?: never,
): T;
export function compute(
  getOrId: any,
  getOrCompute: any,
  computeOrUndefined: any,
) {
  if (typeof getOrId === 'string') {
    return { [`${prefix}_${getOrId}`]: computeOrUndefined };
  }
  return { [`${prefix}_${prefixCounter++}`]: getOrCompute };
}

/**
 * Aplica computed functions encontradas nas entries do estado.
 * Usado internamente pelo postprocess.
 */
function applyLocalComputed(state: any): Record<string, any> {
  const computedFunctions = Object.entries(state)
    .filter(([k]) => k.startsWith(prefix))
    .map(([, v]) => v as (s: any) => any);

  if (computedFunctions.length === 0) return {};

  const result = computedFunctions.reduce(
    (acc, fn) => Object.assign(acc, fn(acc)),
    { ...state },
  );

  // Retornar apenas as chaves novas (não-computed) que foram geradas
  const newKeys: Record<string, any> = {};
  for (const [k, v] of Object.entries(result)) {
    if (!k.startsWith(prefix) && !(k in state && state[k] === v)) {
      newKeys[k] = v;
    }
  }
  return newKeys;
}

/**
 * Gera o objeto [meta] com postprocess para computed automático.
 * Usar dentro de cada lens:
 *
 * lens((set, get) => ({
 *   count: 0,
 *   ...compute('double', get, (s) => ({ double: s.count * 2 })),
 *   ...computedMeta(),
 * }))
 */
export function computedMeta() {
  return {
    [meta]: {
      postprocess(state: any, _prevState: any) {
        return applyLocalComputed(state);
      },
    },
  };
}

/**
 * Para computed cross-lens no nível raiz.
 * Recebe uma função que cria o [meta].postprocess com acesso ao api.
 *
 * Usar no root do withLenses:
 * withLenses((set, get, api) => ({
 *   ...computedRootMeta(get),
 * }))
 */
export function computedRootMeta(rootGet: () => any) {
  return {
    [meta]: {
      postprocess(state: any, _prevState: any) {
        // Para root, podemos acessar o get global para cross-lens
        return applyLocalComputed(state);
      },
    },
  };
}
```

**Pontos de atenção:**
- `postprocess` recebe `(state, prevState, ...args)` e retorna `Partial<T> | void`
- `postprocess` roda APÓS cada `set`, mas NÃO na inicialização. Para inicializar computed na criação, precisa calcular os valores manualmente.
- Para cross-lens, `postprocess` no root recebe o estado raiz, então consegue ver todos os lenses.
- **Limitação**: cada lens precisa incluir `...computedMeta()` explicitamente — mais boilerplate.

---

### 4. `src/middleware/computed-lens-factory.ts` — Abordagem C

Factory que wrapa `lens()` e aplica computed automaticamente.

```ts
import { lens, meta } from '@dhmk/zustand-lens';
import type { Lens, Setter, Getter, ResolveStoreApi, LensContext } from '@dhmk/zustand-lens';

const prefix = '$$_computed';
let prefixCounter = 0;

type ComputeFunctionType<StoreType, T> = (store: StoreType) => T;

export function compute<StoreType, T extends Partial<StoreType>>(
  id: string,
  get: () => StoreType,
  compute: ComputeFunctionType<StoreType, T>,
): T;
export function compute<StoreType, T extends Partial<StoreType>>(
  get: () => StoreType,
  compute: ComputeFunctionType<StoreType, T>,
  other?: never,
): T;
export function compute(
  getOrId: any,
  getOrCompute: any,
  computeOrUndefined: any,
) {
  if (typeof getOrId === 'string') {
    return { [`${prefix}_${getOrId}`]: computeOrUndefined };
  }
  return { [`${prefix}_${prefixCounter++}`]: getOrCompute };
}

function applyComputedToObject(state: any): any {
  const computedFunctions = Object.entries(state)
    .filter(([k]) => k.startsWith(prefix))
    .map(([, v]) => v as (s: any) => any);

  if (computedFunctions.length === 0) return state;

  return computedFunctions.reduce(
    (acc, fn) => Object.assign(acc, fn(acc)),
    { ...state },
  );
}

/**
 * Factory que combina lens() + computed.
 * Substitui lens() para slices que usam computed.
 *
 * Uso:
 * computedLens<MyType>((set, get) => ({
 *   count: 0,
 *   increment: () => set({ count: get().count + 1 }),
 *   ...compute('double', get, (s) => ({ double: s.count * 2 })),
 * }))
 */
export function computedLens<T, S = unknown>(
  fn: (
    set: Setter<T>,
    get: Getter<T>,
    api: ResolveStoreApi<S>,
    ctx: LensContext<T, S>,
  ) => T,
) {
  return lens<T, S>((set, get, api, ctx) => {
    // Criar wrapper de set que aplica computed após cada update
    const originalSet = set;
    const computedSet: Setter<T> = (partial, replace, ...args) => {
      // Precisamos interceptar: após o set, recomputar os valores
      // Mas como set é async por natureza, usamos postprocess
      originalSet(partial, replace, ...args);
    };

    const state = fn(computedSet, get, api, ctx);

    // Aplicar computed na inicialização
    const initialComputed = applyComputedToObject(state);

    // Adicionar postprocess para updates futuros
    const existingMeta = initialComputed[meta as any];
    const existingPostprocess = existingMeta?.postprocess;

    return {
      ...initialComputed,
      [meta]: {
        ...existingMeta,
        postprocess(newState: any, prevState: any, ...args: any[]) {
          const withComputed = applyComputedToObject(newState);
          const diff: Record<string, any> = {};
          for (const [k, v] of Object.entries(withComputed)) {
            if (!k.startsWith(prefix) && newState[k] !== v) {
              diff[k] = v;
            }
          }
          // Se havia um postprocess existente, executá-lo também
          const existingResult = existingPostprocess?.(newState, prevState, ...args);
          return { ...diff, ...existingResult };
        },
      },
    } as T;
  });
}

/**
 * Para computed cross-lens no root.
 * Usar com withLenses:
 *
 * withLenses((set, get) => ({
 *   counter: computedLens(...),
 *   todo: computedLens(...),
 *   ...computeRoot(get, (state) => ({
 *     summary: `${state.counter.count} + ${state.todo.totalTodos}`
 *   })),
 * }))
 */
export function computeRoot<T>(
  id: string,
  get: () => T,
  fn: (state: T) => Partial<T>,
): Partial<T> {
  return {
    [`${prefix}_${id}`]: fn,
  } as any;
}
```

**Pontos de atenção:**
- `computedLens()` substitui `lens()` — API mais limpa, sem necessidade de helpers adicionais.
- Usa `[meta].postprocess` internamente, então é essencialmente a abordagem B encapsulada.
- Cross-lens continua sendo no nível root.
- Funciona tanto na inicialização (aplicando computed no retorno) quanto em updates (via postprocess).

---

### 5. `src/stores/store-flat.ts` — Baseline (demonstra o problema)

```ts
import { create, type StateCreator } from 'zustand';
import { computed, compute } from '../middleware/computed-original';

// ---- Counter Service ----
type CounterSlice = {
  count: number;
  isLoading: boolean;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  // computed
  doubleCount: number;
  isPositive: boolean;
};

// ---- Todo Service ----
type TodoSlice = {
  todos: string[];
  isLoading: boolean;
  addTodo: (text: string) => void;
  removeTodo: (index: number) => void;
  reset: () => void;
  // computed
  totalTodos: number;
  hasTodos: boolean;
};

// PROBLEMA: reset() e isLoading colidem!
// O TypeScript pode não reclamar se os tipos forem compatíveis,
// mas o ÚLTIMO spread vence — o comportamento de reset() do
// TodoService sobrescreve o do CounterService.
type FlatStore = CounterSlice & TodoSlice & {
  summary: string;
};

type FlatService<T> = StateCreator<FlatStore, [], [], T>;

const createCounterService: FlatService<CounterSlice> = (set, get) => ({
  count: 0,
  isLoading: false,
  increment: () => {
    console.log('[Counter] increment');
    set({ count: get().count + 1 });
  },
  decrement: () => set({ count: get().count - 1 }),
  reset: () => {
    console.log('[Counter] reset chamado');
    set({ count: 0, isLoading: false });
  },
  ...compute('counterDouble', get, (s: FlatStore) => ({
    doubleCount: s.count * 2,
  })),
  ...compute('counterPositive', get, (s: FlatStore) => ({
    isPositive: s.count > 0,
  })),
});

const createTodoService: FlatService<TodoSlice> = (set, get) => ({
  todos: [] as string[],
  isLoading: false,
  addTodo: (text: string) => set({ todos: [...get().todos, text] }),
  removeTodo: (index: number) =>
    set({ todos: get().todos.filter((_, i) => i !== index) }),
  reset: () => {
    console.log('[Todo] reset chamado — ESTE sobrescreve o Counter.reset!');
    set({ todos: [], isLoading: false });
  },
  ...compute('todoTotal', get, (s: FlatStore) => ({
    totalTodos: s.todos.length,
  })),
  ...compute('todoHas', get, (s: FlatStore) => ({
    hasTodos: s.todos.length > 0,
  })),
});

export const useFlatStore = create<FlatStore>()(
  computed((...a) => ({
    ...createCounterService(...a),
    ...createTodoService(...a),
    // cross-service computed
    ...compute('summary', a[1], (s: FlatStore) => ({
      summary: `Counter: ${s.count} (x2=${s.doubleCount}) | Todos: ${s.totalTodos} items`,
    })),
  })),
);
```

---

### 6. `src/stores/store-approach-a.ts`

```ts
import { create } from 'zustand';
import { withLenses, lens } from '@dhmk/zustand-lens';
import { computed, compute } from '../middleware/computed-recursive';

// ---- Types ----
type CounterState = {
  count: number;
  isLoading: boolean;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  doubleCount: number;
  isPositive: boolean;
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
  counter: CounterState;
  todo: TodoState;
  summary: string;
};

export const useStoreA = create<RootStore>()(
  computed(
    withLenses((set, get) => ({
      counter: lens<CounterState>((set, get) => ({
        count: 0,
        isLoading: false,
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 }),
        reset: () => {
          console.log('[A/Counter] reset');
          set({ count: 0, isLoading: false });
        },
        // computed LOCAL — recebe estado do lens (CounterState)
        ...compute('doubleCount', get, (s: CounterState) => ({
          doubleCount: s.count * 2,
        })),
        ...compute('isPositive', get, (s: CounterState) => ({
          isPositive: s.count > 0,
        })),
      })),

      todo: lens<TodoState>((set, get) => ({
        todos: [] as string[],
        isLoading: false,
        addTodo: (text: string) => set({ todos: [...get().todos, text] }),
        removeTodo: (index: number) =>
          set({ todos: get().todos.filter((_, i) => i !== index) }),
        reset: () => {
          console.log('[A/Todo] reset');
          set({ todos: [], isLoading: false });
        },
        // computed LOCAL
        ...compute('totalTodos', get, (s: TodoState) => ({
          totalTodos: s.todos.length,
        })),
        ...compute('hasTodos', get, (s: TodoState) => ({
          hasTodos: s.todos.length > 0,
        })),
      })),

      // computed CROSS-LENS no nível raiz — recebe RootStore inteira
      ...compute('summary', get, (s: RootStore) => ({
        summary: `Counter: ${s.counter.count} (x2=${s.counter.doubleCount}) | Todos: ${s.todo.totalTodos} items`,
      })),
    })),
  ),
);
```

---

### 7. `src/stores/store-approach-b.ts`

```ts
import { create } from 'zustand';
import { withLenses, lens, meta } from '@dhmk/zustand-lens';
import { compute, computedMeta, computedRootMeta } from '../middleware/computed-postprocess';

type CounterState = {
  count: number;
  isLoading: boolean;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  doubleCount: number;
  isPositive: boolean;
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
  counter: CounterState;
  todo: TodoState;
  summary: string;
};

export const useStoreB = create<RootStore>()(
  withLenses((set, get) => ({
    counter: lens<CounterState>((set, get) => ({
      count: 0,
      isLoading: false,
      increment: () => set({ count: get().count + 1 }),
      decrement: () => set({ count: get().count - 1 }),
      reset: () => {
        console.log('[B/Counter] reset');
        set({ count: 0, isLoading: false });
      },
      // Valores iniciais dos computed (postprocess não roda na init)
      doubleCount: 0,
      isPositive: false,
      // computed markers
      ...compute('doubleCount', get, (s: CounterState) => ({
        doubleCount: s.count * 2,
      })),
      ...compute('isPositive', get, (s: CounterState) => ({
        isPositive: s.count > 0,
      })),
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
        console.log('[B/Todo] reset');
        set({ todos: [], isLoading: false });
      },
      totalTodos: 0,
      hasTodos: false,
      ...compute('totalTodos', get, (s: TodoState) => ({
        totalTodos: s.todos.length,
      })),
      ...compute('hasTodos', get, (s: TodoState) => ({
        hasTodos: s.todos.length > 0,
      })),
      ...computedMeta(),
    })),

    // cross-lens no root
    summary: '',
    ...compute('summary', get, (s: RootStore) => ({
      summary: `Counter: ${s.counter.count} (x2=${s.counter.doubleCount}) | Todos: ${s.todo.totalTodos} items`,
    })),
    ...computedRootMeta(get),
  })),
);
```

**ATENÇÃO:** Na abordagem B, os valores computed precisam ser inicializados manualmente (ex: `doubleCount: 0`) porque `postprocess` só roda em `set`, não na criação do store. Isso é uma desvantagem significativa.

---

### 8. `src/stores/store-approach-c.ts`

```ts
import { create } from 'zustand';
import { withLenses } from '@dhmk/zustand-lens';
import { computedLens, compute, computeRoot } from '../middleware/computed-lens-factory';

type CounterState = {
  count: number;
  isLoading: boolean;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  doubleCount: number;
  isPositive: boolean;
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
  counter: CounterState;
  todo: TodoState;
  summary: string;
};

export const useStoreC = create<RootStore>()(
  withLenses((set, get) => ({
    // computedLens substitui lens — API mais limpa
    counter: computedLens<CounterState>((set, get) => ({
      count: 0,
      isLoading: false,
      increment: () => set({ count: get().count + 1 }),
      decrement: () => set({ count: get().count - 1 }),
      reset: () => {
        console.log('[C/Counter] reset');
        set({ count: 0, isLoading: false });
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
        console.log('[C/Todo] reset');
        set({ todos: [], isLoading: false });
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
);
```

**NOTA sobre cross-lens na Abordagem C:** o `computeRoot` depende de `[meta].postprocess` no root, que não é aplicado automaticamente. Para funcionar, precisa de um wrapper adicional no root ou combinar com a Abordagem A.

---

## Global Store — Padrão Real (Multi-Service)

### Objetivo

Validar o comportamento do middleware `computed` em um cenário que espelha a arquitetura real
do projeto (`useApp`): múltiplos services combinados via spread em um único store flat, com o
tipo auxiliar `AppService<T>` para tipagem de cada slice.

Este cenário adiciona um terceiro service (`AuthService`) para aumentar a escala e tornar as
colisões de nomes mais evidentes (`reset()` e `isLoading` presentes em **todos os três** services).

---

### Services de Teste

#### AuthService
- Estado: `isAuthenticated: boolean`, `user: string | null`, `isLoading: boolean`
- Ações: `login(user: string)`, `logout()`, `reset()`
- Computed: `displayName` (`user ?? 'Guest'`)

#### CounterService (reaproveitado)
- Estado: `count: number`, `isLoading: boolean`
- Ações: `increment()`, `decrement()`, `reset()`
- Computed: `doubleCount`, `isPositive`

#### TodoService (reaproveitado)
- Estado: `todos: string[]`, `isLoading: boolean`
- Ações: `addTodo(text)`, `removeTodo(index)`, `reset()`
- Computed: `totalTodos`, `hasTodos`

**Cross-service computed (root):** `summary: string` — combina dados dos três services.

**Colisões de nomes:** `reset()` e `isLoading` existem nos três services; no store flat o
último spread vence — o comportamento esperado é demonstrado e documentado.

---

### Estrutura de Arquivos (Global)

```
src/
  stores/
    store-global-flat.ts     # Flat global (espelha useApp real) — computed-original
    store-global-a.ts        # Global com lenses — computed recursivo (Abordagem A)
    store-global-b.ts        # Global com lenses — meta.postprocess  (Abordagem B)
    store-global-c.ts        # Global com lenses — computedLens factory (Abordagem C)
  components/
    GlobalFlat.tsx           # UI do global flat
    GlobalA.tsx              # UI do global com lenses A
    GlobalB.tsx              # UI do global com lenses B
    GlobalC.tsx              # UI do global com lenses C
```

---

### Tipos Auxiliares (espelhando o padrão real)

```ts
// Cada interface de service define o contrato público
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

// Intersecção dos services — espelha CombinedAppServices do projeto real
type CombinedServices = IAuthService & ICounterService & ITodoService & {
  summary: string
}

// Helper de tipagem para os slice creators — espelha AppService<T>
type GlobalService<T> = StateCreator<CombinedServices, [], [], T>
```

---

### 12. `src/stores/store-global-flat.ts` — Global Flat (Baseline Real)

Espelha o padrão do `useApp` real:

```ts
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
```

---

### 13. `src/stores/store-global-a.ts` — Global com Lenses (Abordagem A)

Migração do store global para lenses usando `computed-recursive`:

```ts
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
```

---

### 14. `src/stores/store-global-b.ts` — Global com Lenses (Abordagem B)

```ts
import { create } from 'zustand'
import { withLenses, lens } from '@dhmk/zustand-lens'
import { compute, computedMeta, computedRootMeta } from '../middleware/computed-postprocess'

// (mesmos tipos IAuthService, ICounterService, ITodoService, GlobalRootStore que store-global-a.ts)

export const useGlobalStoreB = create<GlobalRootStore>()(
  withLenses((_set, get) => ({
    auth: lens<IAuthService>((set, get) => ({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      displayName: 'Guest', // valor inicial manual obrigatório
      login: (user: string) => set({ isAuthenticated: true, user }),
      logout: () => set({ isAuthenticated: false, user: null }),
      reset: () => set({ isAuthenticated: false, user: null, isLoading: false }),
      ...compute('displayName', get, (s: IAuthService) => ({
        displayName: s.user ?? 'Guest',
      })),
      ...computedMeta(),
    })),

    counter: lens<ICounterService>((set, get) => ({
      count: 0,
      isLoading: false,
      doubleCount: 0,   // valor inicial manual obrigatório
      isPositive: false, // valor inicial manual obrigatório
      increment: () => set({ count: get().count + 1 }),
      decrement: () => set({ count: get().count - 1 }),
      reset: () => set({ count: 0, isLoading: false }),
      ...compute('doubleCount', get, (s: ICounterService) => ({
        doubleCount: s.count * 2,
      })),
      ...compute('isPositive', get, (s: ICounterService) => ({
        isPositive: s.count > 0,
      })),
      ...computedMeta(),
    })),

    todo: lens<ITodoService>((set, get) => ({
      todos: [] as string[],
      isLoading: false,
      totalTodos: 0,   // valor inicial manual obrigatório
      hasTodos: false, // valor inicial manual obrigatório
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
      ...computedMeta(),
    })),

    summary: '',
    ...compute('summary', get, (s: GlobalRootStore) => ({
      summary: `Auth: ${s.auth.displayName} | Counter: ${s.counter.count} (x2=${s.counter.doubleCount}) | Todos: ${s.todo.totalTodos}`,
    })),
    ...computedRootMeta(get),
  })),
)
```

---

### 15. `src/stores/store-global-c.ts` — Global com Lenses (Abordagem C)

```ts
import { create } from 'zustand'
import { withLenses } from '@dhmk/zustand-lens'
import { computedLens, compute, computeRoot } from '../middleware/computed-lens-factory'

// (mesmos tipos IAuthService, ICounterService, ITodoService, GlobalRootStore que store-global-a.ts)

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
```

---

### 16. `src/components/GlobalFlat.tsx`

```tsx
import { useGlobalFlatStore } from '../stores/store-global-flat'
import { StorePanel, ValueDisplay } from './StorePanel'

export function GlobalFlat() {
  const store = useGlobalFlatStore()

  return (
    <StorePanel
      title="Global Flat (Padrão Real)"
      description="Espelha o useApp real: múltiplos services com CombinedServices + GlobalService<T>. Colisões de reset() e isLoading são demonstradas."
    >
      <div className="service-section">
        <h3>Auth</h3>
        <ValueDisplay label="isAuthenticated" value={store.isAuthenticated} />
        <ValueDisplay label="user" value={store.user ?? '(null)'} />
        <ValueDisplay label="isLoading" value={store.isLoading} />
        <ValueDisplay label="displayName" value={store.displayName} isComputed />
        <div className="actions">
          <button onClick={() => store.login('Alice')}>Login Alice</button>
          <button onClick={() => store.logout()}>Logout</button>
        </div>
      </div>

      <div className="service-section">
        <h3>Counter</h3>
        <ValueDisplay label="count" value={store.count} />
        <ValueDisplay label="doubleCount" value={store.doubleCount} isComputed />
        <ValueDisplay label="isPositive" value={store.isPositive} isComputed />
        <div className="actions">
          <button onClick={() => store.increment()}>+</button>
          <button onClick={() => store.decrement()}>-</button>
        </div>
      </div>

      <div className="service-section">
        <h3>Todo</h3>
        <ValueDisplay label="todos" value={JSON.stringify(store.todos)} />
        <ValueDisplay label="totalTodos" value={store.totalTodos} isComputed />
        <ValueDisplay label="hasTodos" value={store.hasTodos} isComputed />
        <div className="actions">
          <button onClick={() => store.addTodo(`Item ${Date.now()}`)}>Add Todo</button>
        </div>
      </div>

      <div className="service-section cross-lens">
        <h3>Cross-Service Computed</h3>
        <ValueDisplay label="summary" value={store.summary} isComputed />
        <div className="actions collision-demo">
          <button onClick={() => store.reset()}>
            reset() — chama QUAL service? (último spread vence)
          </button>
        </div>
      </div>
    </StorePanel>
  )
}
```

---

### 17. `src/components/GlobalA.tsx`, `GlobalB.tsx`, `GlobalC.tsx`

Seguem o mesmo padrão de `GlobalFlat.tsx`, mas com acesso lensed (`store.auth.*`, `store.counter.*`, `store.todo.*`) e título/descrição atualizados. O botão `reset()` é substituído por três botões independentes (`store.auth.reset()`, `store.counter.reset()`, `store.todo.reset()`), demonstrando que as colisões foram resolvidas.

```tsx
// Exemplo: GlobalA.tsx
import { useGlobalStoreA } from '../stores/store-global-a'
import { StorePanel, ValueDisplay } from './StorePanel'

export function GlobalA() {
  const store = useGlobalStoreA()

  return (
    <StorePanel
      title="Global A: Computed Recursivo"
      description="Store global migrado para lenses. Cada service tem seu próprio reset() sem colisão."
    >
      <div className="service-section">
        <h3>Auth (lens)</h3>
        <ValueDisplay label="isAuthenticated" value={store.auth.isAuthenticated} />
        <ValueDisplay label="user" value={store.auth.user ?? '(null)'} />
        <ValueDisplay label="isLoading" value={store.auth.isLoading} />
        <ValueDisplay label="displayName" value={store.auth.displayName} isComputed />
        <div className="actions">
          <button onClick={() => store.auth.login('Alice')}>Login Alice</button>
          <button onClick={() => store.auth.logout()}>Logout</button>
          <button onClick={() => store.auth.reset()}>Reset Auth</button>
        </div>
      </div>

      <div className="service-section">
        <h3>Counter (lens)</h3>
        <ValueDisplay label="count" value={store.counter.count} />
        <ValueDisplay label="doubleCount" value={store.counter.doubleCount} isComputed />
        <ValueDisplay label="isPositive" value={store.counter.isPositive} isComputed />
        <div className="actions">
          <button onClick={() => store.counter.increment()}>+</button>
          <button onClick={() => store.counter.decrement()}>-</button>
          <button onClick={() => store.counter.reset()}>Reset Counter</button>
        </div>
      </div>

      <div className="service-section">
        <h3>Todo (lens)</h3>
        <ValueDisplay label="todos" value={JSON.stringify(store.todo.todos)} />
        <ValueDisplay label="totalTodos" value={store.todo.totalTodos} isComputed />
        <ValueDisplay label="hasTodos" value={store.todo.hasTodos} isComputed />
        <div className="actions">
          <button onClick={() => store.todo.addTodo(`Item ${Date.now()}`)}>Add Todo</button>
          <button onClick={() => store.todo.reset()}>Reset Todos</button>
        </div>
      </div>

      <div className="service-section cross-lens">
        <h3>Cross-Lens Computed</h3>
        <ValueDisplay label="summary" value={store.summary} isComputed />
      </div>
    </StorePanel>
  )
}
// GlobalB.tsx e GlobalC.tsx seguem o mesmo padrão, trocando useGlobalStoreA por
// useGlobalStoreB / useGlobalStoreC e ajustando título e descrição.
```

---

### 9. `src/components/StorePanel.tsx`

Componente genérico para exibir o estado de qualquer abordagem:

```tsx
import { type ReactNode } from 'react';

type StorePanelProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function StorePanel({ title, description, children }: StorePanelProps) {
  return (
    <div className="store-panel">
      <h2>{title}</h2>
      <p className="description">{description}</p>
      <div className="panel-content">{children}</div>
    </div>
  );
}

type ValueDisplayProps = {
  label: string;
  value: unknown;
  isComputed?: boolean;
};

export function ValueDisplay({ label, value, isComputed }: ValueDisplayProps) {
  return (
    <div className={`value-display ${isComputed ? 'computed' : ''}`}>
      <span className="label">{label}:</span>
      <span className="value">
        {typeof value === 'boolean'
          ? value ? 'true' : 'false'
          : String(value)}
      </span>
    </div>
  );
}
```

---

### 10. Componentes por abordagem

Cada componente (FlatBaseline.tsx, ApproachA.tsx, ApproachB.tsx, ApproachC.tsx) segue o mesmo padrão:

```tsx
// Exemplo: ApproachA.tsx
import { useStoreA } from '../stores/store-approach-a';
import { StorePanel, ValueDisplay } from './StorePanel';

export function ApproachA() {
  const store = useStoreA();

  return (
    <StorePanel
      title="Abordagem A: Computed Recursivo"
      description="Computed middleware modificado para percorrer estado aninhado recursivamente"
    >
      <div className="service-section">
        <h3>Counter (lens)</h3>
        <ValueDisplay label="count" value={store.counter.count} />
        <ValueDisplay label="isLoading" value={store.counter.isLoading} />
        <ValueDisplay label="doubleCount" value={store.counter.doubleCount} isComputed />
        <ValueDisplay label="isPositive" value={store.counter.isPositive} isComputed />
        <div className="actions">
          <button onClick={() => store.counter.increment()}>+</button>
          <button onClick={() => store.counter.decrement()}>-</button>
          <button onClick={() => store.counter.reset()}>Reset Counter</button>
        </div>
      </div>

      <div className="service-section">
        <h3>Todo (lens)</h3>
        <ValueDisplay label="todos" value={JSON.stringify(store.todo.todos)} />
        <ValueDisplay label="isLoading" value={store.todo.isLoading} />
        <ValueDisplay label="totalTodos" value={store.todo.totalTodos} isComputed />
        <ValueDisplay label="hasTodos" value={store.todo.hasTodos} isComputed />
        <div className="actions">
          <button onClick={() => store.todo.addTodo(`Item ${Date.now()}`)}>
            Add Todo
          </button>
          <button onClick={() => store.todo.reset()}>Reset Todos</button>
        </div>
      </div>

      <div className="service-section cross-lens">
        <h3>Cross-Lens Computed</h3>
        <ValueDisplay label="summary" value={store.summary} isComputed />
      </div>
    </StorePanel>
  );
}
```

Para o **FlatBaseline**, o acesso é direto (sem `.counter.` ou `.todo.`), e a colisão de `reset()` deve ser demonstrada com um aviso visual.

---

### 11. `src/App.tsx`

```tsx
import { useState } from 'react'
import { FlatBaseline } from './components/FlatBaseline'
import { ApproachA } from './components/ApproachA'
import { ApproachB } from './components/ApproachB'
import { ApproachC } from './components/ApproachC'
import { GlobalFlat } from './components/GlobalFlat'
import { GlobalA } from './components/GlobalA'
import { GlobalB } from './components/GlobalB'
import { GlobalC } from './components/GlobalC'
import './App.css'

const tabs = [
  // --- Abordagens com 2 services (Counter + Todo) ---
  { id: 'flat', label: 'Flat (Baseline)', component: FlatBaseline },
  { id: 'a', label: 'A) Computed Recursivo', component: ApproachA },
  { id: 'b', label: 'B) meta.postprocess', component: ApproachB },
  { id: 'c', label: 'C) computedLens Factory', component: ApproachC },
  // --- Global store (padrão real: 3 services + AppService<T>) ---
  { id: 'global-flat', label: 'Global Flat (Real)', component: GlobalFlat },
  { id: 'global-a', label: 'Global A) Recursivo', component: GlobalA },
  { id: 'global-b', label: 'Global B) postprocess', component: GlobalB },
  { id: 'global-c', label: 'Global C) Factory', component: GlobalC },
] as const

function App() {
  const [activeTab, setActiveTab] = useState(tabs[0].id)
  const ActiveComponent = tabs.find(t => t.id === activeTab)!.component

  return (
    <div className="app">
      <h1>POC: zustand-computed + zustand-lens</h1>
      <nav className="tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <main>
        <ActiveComponent />
      </main>
    </div>
  )
}

export default App
```

---

## Checklist de Validação

Para cada abordagem (Flat Baseline, A, B, C e suas variantes Global), verificar:

- [ ] **Computed local funciona na inicialização** — Os valores computed estão corretos quando o store é criado
- [ ] **Computed local funciona em updates** — Ao chamar `increment()`, `doubleCount` atualiza
- [ ] **Cross-lens computed funciona** — `summary` reflete dados de ambos os lenses
- [ ] **Sem colisão de nomes** — `counter.reset()` e `todo.reset()` são independentes (apenas abordagens com lens)
- [ ] **Reatividade React ok** — Componentes re-renderizam quando computed values mudam
- [ ] **Console não mostra erros** — Nenhum warning ou erro no console

### Validações adicionais — Global Store

- [ ] **Padrão `AppService<T>` funciona** — `GlobalService<T>` / `StateCreator<CombinedServices, [], [], T>` compila sem erros
- [ ] **Colisão demonstrada no flat** — Clicar em `reset()` no `GlobalFlat` chama apenas o TodoService (último spread); Auth e Counter não são resetados
- [ ] **Colisão resolvida nas abordagens com lens** — `store.auth.reset()`, `store.counter.reset()` e `store.todo.reset()` operam de forma independente
- [ ] **Computed com 3 services** — `displayName`, `doubleCount`, `totalTodos` e `summary` calculados corretamente com três sources
- [ ] **`isLoading` isolado por lens** — Cada lens tem seu próprio `isLoading` sem sobrescrever os outros

---

## Comparação Esperada

### Abordagens com 2 services (Counter + Todo)

| Critério | Flat (baseline) | A) Recursivo | B) postprocess | C) Factory |
|---|---|---|---|---|
| Colisão de nomes | SIM (problema) | Resolvido | Resolvido | Resolvido |
| Computed local init | Funciona | Deve funcionar | Precisa valor manual | Deve funcionar |
| Computed local update | Funciona | Deve funcionar | Deve funcionar | Deve funcionar |
| Cross-lens computed | Funciona | Deve funcionar | Pode ter issues | Precisa combinar |
| Boilerplate | Baixo | Baixo | Alto (computedMeta) | Médio |
| Performance | O(n) | O(n*depth) por set | O(n) por lens | O(n) por lens |
| Complexidade impl | Simples | Simples | Média | Média |

### Abordagens com Global Store (3 services — padrão real)

| Critério | Global Flat | Global A) Recursivo | Global B) postprocess | Global C) Factory |
|---|---|---|---|---|
| Espelha padrão `useApp` | SIM | Migração com lens | Migração com lens | Migração com lens |
| Colisão `reset()` | SIM (3-way) | Resolvida | Resolvida | Resolvida |
| Colisão `isLoading` | SIM (3-way) | Resolvida | Resolvida | Resolvida |
| `AppService<T>` typing | Funciona | `GlobalService<T>` equiv. | `GlobalService<T>` equiv. | `GlobalService<T>` equiv. |
| Computed 3 services | Deve funcionar | Deve funcionar | Precisa init manual | Deve funcionar |
| Cross-service `summary` | Funciona | Deve funcionar | Pode ter issues | Precisa combinar |
| Custo de migração | — | Baixo | Alto | Médio |

---

## Riscos e Limitações Conhecidas

1. **Abordagem A**: A cada `set`, percorre TODA a árvore de estado. Se o estado for grande com muitos lenses aninhados, pode impactar performance.

2. **Abordagem B**: `postprocess` não roda na criação do store, apenas em `set`. Computed values precisam de valores iniciais explícitos. Isso viola o princípio de "declarar uma vez e o framework calcula".

3. **Abordagem C**: Para cross-lens computed, precisa de mecanismo adicional no root. A factory `computedLens` cuida do nível local, mas não do root.

4. **Todas**: As chaves `$$_computed_*` permanencem no estado. Isso pode causar confusão em devtools ou serialização. Considerar limpá-las do estado final.

5. **Ordering entre withLenses e computed**: Na abordagem A, a ordem `computed(withLenses(...))` é crucial — computed DEVE ser o wrapper externo para interceptar o `set` raiz.
