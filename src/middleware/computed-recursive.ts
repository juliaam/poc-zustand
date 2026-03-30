import type { StateCreator, StoreMutatorIdentifier } from "zustand";

const prefix = "$$_computed";
let prefixCounter = 0;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
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
        const updated = typeof update === "function" ? update(state) : update;
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
  if (typeof getOrId === "string") {
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
