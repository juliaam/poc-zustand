import type { StateCreator, StoreMutatorIdentifier } from 'zustand'

const prefix = '$$_computed'
let prefixCounter = 0

function injectComputedMiddleware(f: StateCreator<any>): StateCreator<any> {
  return (set, get, api) => {
    function applyComputedState(state: any) {
      const computedFunctions = Object.entries(state)
        .filter(s => s[0].startsWith(prefix))
        .map(s => s[1] as ComputeFunctionType<any, any>)
      const computedSt = computedFunctions.reduce(
        (acc, cur) => Object.assign(acc, cur(acc)),
        state,
      )
      return computedSt
    }

    function setWithComputed(
      update: any | ((state: any) => any),
      replace?: boolean,
    ) {
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

export function compute(
  getOrId: any,
  getOrCompute: any,
  computeOrUndefined: any,
) {
  if (typeof getOrId === 'string') {
    return {
      [`${prefix}_${getOrId}`]: computeOrUndefined,
    }
  }
  return {
    [`${prefix}_${prefixCounter++}`]: getOrCompute,
  }
}

type ComputedState = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  f: StateCreator<T, Mps, Mcs>,
) => StateCreator<T, Mps, Mcs>

export const computed = ((f: any) =>
  injectComputedMiddleware(f)) as unknown as ComputedState
