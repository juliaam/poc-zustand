import { type PersistOptions } from 'zustand/middleware'

import { mergeDeep } from '../deepMerge'
import { isPlainObject } from '../isPlainObject'
import { objectMap } from '../utils'

import { type Getter, type Lens, type LensContext, type LensMetaProps, type ResolveStoreApi, type SetParameter } from './core'

export const mergeDeepLeft = <T>(a: unknown, b: T): T => mergeDeep(b, a as any)

export type CustomSetter<F, T, S> = [set: F, get: Getter<T>, api: ResolveStoreApi<S>, ctx: LensContext<T, S>]

export const customSetter = (setter: any) => (fn: any) => (set: any, get: any, api: any, ctx: any) =>
  fn(setter(set), get, api, ctx)

export type NamedSet<T> = (partial: SetParameter<T>, name?: string, replace?: boolean) => void

export const namedSetter = customSetter(
  (set: any) => (partial: any, name?: string, replace?: boolean) => set(partial, replace, name),
) as <T, S = any>(fn: (...args: CustomSetter<NamedSet<T>, T, S>) => T) => Lens<T, S>

export function subscribe<T, U>(
  store: { subscribe: (fn: (s: T) => any) => any; getState(): T },
  selector: (state: T) => U,
  effect: (state: U, prevState: U) => void,
  options: {
    equalityFn?: (a: U, b: U) => boolean
    fireImmediately?: boolean
  } = {},
) {
  const { equalityFn = Object.is, fireImmediately = false } = options

  let curr = selector(store.getState())

  if (fireImmediately) effect(curr, curr)

  return store.subscribe(state => {
    const next = selector(state)
    if (!equalityFn(next, curr)) {
      const prev = curr
      effect((curr = next), prev)
    }
  })
}

type MetaSetter<T, S> = Exclude<LensMetaProps<T, S>['setter'], undefined>

export function watch<T = any, U = any, S = any>(
  selector: (state: T) => U,
  effect: (state: U, prevState: U) => void,
  options: {
    equalityFn?: (a: U, b: U) => boolean
    fireImmediately?: boolean
  } = {},
): MetaSetter<T, S> {
  const { equalityFn = Object.is, fireImmediately = false } = options

  let curr: U | undefined

  if (fireImmediately) effect(undefined as unknown as U, undefined as unknown as U)

  return function (set, ctx) {
    if (!curr) curr = selector(ctx.get())

    set()

    const next = selector(ctx.get())

    if (!equalityFn(next, curr)) {
      const prev = curr
      effect((curr = next), prev)
    }
  }
}

export function combineWatchers<T, S>(...fns: MetaSetter<T, S>[]): MetaSetter<T, S> {
  let initialized = false

  const runWatchers = (ctx: any) => fns.forEach(fn => fn(() => {}, ctx))

  return (set, ctx) => {
    if (!initialized) {
      initialized = true
      runWatchers(ctx)
    }

    set()

    runWatchers(ctx)
  }
}

const persist = Symbol('persist')

export function persistOptions<T>(conf: { load?: (x: unknown) => T; save?: (x: T) => unknown }) {
  return {
    [persist]: conf,
  }
}

function walk(x: any, fn: any): any {
  return isPlainObject(x) ? objectMap(fn(x), v => walk(v, fn)) : x
}

const zustandPersistOptions: Pick<PersistOptions<any>, 'merge' | 'partialize'> = {
  merge(persistedState: any = {}, currentState) {
    return walk(mergeDeep(currentState, persistedState), (x: any) => x[persist]?.load?.(x) ?? x)
  },

  partialize(state) {
    return walk(state, (x: any) => x[persist]?.save?.(x) ?? x)
  },
}

// for typescript
persistOptions.merge = zustandPersistOptions.merge
persistOptions.partialize = zustandPersistOptions.partialize
