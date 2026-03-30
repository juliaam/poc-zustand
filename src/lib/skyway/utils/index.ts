import { type PropType, type StrKeyOf } from './types'

export * from './types'

export const id = <T>(x: T) => x

export function objectFrom<V, K extends keyof any = keyof any>(entries: Iterable<[K, V]>): Record<K, V> {
  return Array.from(entries).reduce((res, [k, v]) => {
    res[k] = v
    return res
  }, {} as any)
}

type ValueMapper<T, R = any> = (v: T[StrKeyOf<T>], k: StrKeyOf<T>, src: T) => R
type KeyMapper<T, R = any> = (k: StrKeyOf<T>, v: T[StrKeyOf<T>], src: T) => R

export function objectMap<T extends object, V extends ValueMapper<T>>(
  src: T,
  mapValue: V,
): Record<StrKeyOf<T>, ReturnType<V>>
export function objectMap<T extends object>(
  src: T,
  mapValue: ValueMapper<T>,
  mapKey?: KeyMapper<T>,
  mapSymbol?: (v: T[keyof T & symbol], k: keyof T & symbol, src: T) => unknown,
): any
export function objectMap(src: any, mapValue: any, mapKey = id as any, mapSymbol = id as any): any {
  return objectFrom(
    Object.keys(src)
      .map(k => [mapKey(k, src[k], src), mapValue(src[k], k, src)])
      .concat(Object.getOwnPropertySymbols(src).map(k => [k, mapSymbol(src[k], k, src)])) as any,
  )
}

export const getIn = <T, P extends string[]>(x: T, path: readonly [...P]): PropType<T, P> =>
  path.reduce((src: any, k) => src[k], x) as any

export const setIn = <T, P extends string[]>(x: T, path: readonly [...P], v: PropType<T, P>): T =>
  updateIn(x, path, () => v)

export const shallowEqual = (a: object, b: object) => {
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  return ka.length === kb.length && ka.every(k => (a as Record<string, any>)[k] === (b as Record<string, any>)[k])
}

export const updateIn = <T, P extends string[]>(
  x: T,
  path: readonly [...P],
  updater: (value: PropType<T, P>) => PropType<T, P>,
): T => {
  if (path.length === 0) {
    return updater(x as any) as any
  }

  const [k, ...rest] = path
  const value = updateIn((x as any)[k], rest as any, updater)

  return (Array.isArray(x) ? arraySet(x, Number(k), value) : objectSet(x as any, k, value)) as T
}

const arraySet = (x: any[], k: number, v: any) => x.map((_v, i) => (i === k ? v : _v))

const objectSet = (x: object, k: string | number | symbol, v: any) => ({ ...x, [k]: v })
