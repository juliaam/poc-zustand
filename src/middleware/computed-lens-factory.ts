import { lens, meta } from '@dhmk/zustand-lens'
import type { Setter, Getter, ResolveStoreApi, LensContext, LensMeta } from '@dhmk/zustand-lens'

const prefix = '$$_computed'
let prefixCounter = 0

type ComputeFunctionType<StoreType, T> = (store: StoreType) => T

export function compute<StoreType, T extends Partial<StoreType>>(
  id: string,
  get: () => StoreType,
  compute: ComputeFunctionType<StoreType, T>,
): T
export function compute<StoreType, T extends Partial<StoreType>>(
  get: () => StoreType,
  compute: ComputeFunctionType<StoreType, T>,
  other?: never,
): T
export function compute(
  getOrId: any,
  getOrCompute: any,
  computeOrUndefined: any,
) {
  if (typeof getOrId === 'string') {
    return { [`${prefix}_${getOrId}`]: computeOrUndefined }
  }
  return { [`${prefix}_${prefixCounter++}`]: getOrCompute }
}

function applyComputedToObject(state: any): any {
  const computedFunctions = Object.entries(state)
    .filter(([k]) => k.startsWith(prefix))
    .map(([, v]) => v as (s: any) => any)

  if (computedFunctions.length === 0) return state

  return computedFunctions.reduce(
    (acc, fn) => Object.assign(acc, fn(acc)),
    { ...state },
  )
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
    const originalSet = set
    const computedSet: Setter<T> = (partial, replace, ...args) => {
      // Precisamos interceptar: após o set, recomputar os valores
      // Mas como set é async por natureza, usamos postprocess
      originalSet(partial, replace, ...args)
    }

    const state = fn(computedSet, get, api, ctx)

    // Aplicar computed na inicialização
    const initialComputed = applyComputedToObject(state)

    // Adicionar postprocess para updates futuros
    const existingMeta = initialComputed[meta as any]
    const existingPostprocess = existingMeta?.postprocess

    return {
      ...initialComputed,
      [meta]: {
        ...existingMeta,
        postprocess(newState: any, prevState: any, ...args: any[]) {
          const withComputed = applyComputedToObject(newState)
          const diff: Record<string, any> = {}
          for (const [k, v] of Object.entries(withComputed)) {
            if (!k.startsWith(prefix) && newState[k] !== v) {
              diff[k] = v
            }
          }
          // Se havia um postprocess existente, executá-lo também
          const existingResult = existingPostprocess?.(newState, prevState, ...args)
          return { ...diff, ...existingResult }
        },
      },
    } as T & LensMeta<T, S>
  })
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
  void get
  return {
    [`${prefix}_${id}`]: fn,
  } as any
}
