import { type NotPlainObject } from './utils/types'

import { isPlainObject } from './isPlainObject'

export type DeepPartial<T> = T extends NotPlainObject
  ? T
  : {
      [P in keyof T]?: T[P] extends NotPlainObject ? T[P] : DeepPartial<T[P]>
    }

type MergeDeep = {
  <T, P extends T = T>(a: T, b: DeepPartial<P> | ((a: T) => DeepPartial<P>)): T
  <T, P extends T = T>(b: DeepPartial<P> | ((a: T) => DeepPartial<P>)): (a: T) => T
}

const mergeDeepRec = (a: any, b: any) => {
  if (!isPlainObject(a) || !isPlainObject(b)) return b

  const res = { ...a, ...b } // copy symbols
  for (const k in b) {
    res[k] = mergeDeepRec(a[k], b[k])
  }
  return res
}

const mergeDeep2 = (a: any, b: any) => mergeDeepRec(a, typeof b === 'function' ? b(a) : b)

export const mergeDeep: MergeDeep = (a: any, b?: any) => {
  return b ? mergeDeep2(a, b) : (b: any) => mergeDeep2(b, a)
}
