import { type StateCreator, type StoreMutatorIdentifier } from 'zustand'

import { isPlainObject } from './isPlainObject'

const prefix = '$$_computed'
let prefixCounter = 0

function applyComputedState(state: any, depth = 0): any {
  if (depth > 5) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[computed] Profundidade maxima de recursao atingida. Possivel referencia circular.')
    }
    return state
  }

  const processed = Object.fromEntries(
    Object.entries(state).map(([key, value]) => {
      if (!isPlainObject(value) || key.startsWith(prefix)) {
        return [key, value]
      }

      return [key, applyComputedState(value, depth + 1)]
    }),
  )

  const computedFunctions = Object.entries(processed)
    .filter(([k]) => k.startsWith(prefix))
    .map(([, v]) => v as (state: any) => any)

  return computedFunctions.reduce((acc, fn) => Object.assign(acc, fn(acc)), processed)
}

function injectComputedMiddleware(f: StateCreator<any>): StateCreator<any> {
  return (set, get, api) => {
    function setWithComputed(update: any | ((state: any) => any), replace?: boolean) {
      set((state: any) => {
        const updated = typeof update === 'function' ? update(state) : update
        const newState = Object.assign({}, state, updated)
        return applyComputedState(newState)
      }, replace as any)
    }

    api.setState = setWithComputed
    const st = f(setWithComputed, get, api)
    return applyComputedState(st)
  }
}

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

export function compute(getOrId: any, getOrCompute: any, computeOrUndefined: any) {
  if (typeof getOrId === 'string') {
    return { [`${prefix}_${getOrId}`]: computeOrUndefined }
  }
  return { [`${prefix}_${prefixCounter++}`]: getOrCompute }
}

type ComputedState = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  f: StateCreator<T, Mps, Mcs>,
) => StateCreator<T, Mps, Mcs>

export const computed = ((f: any) => injectComputedMiddleware(f)) as unknown as ComputedState
