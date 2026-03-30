/* eslint-disable @typescript-eslint/no-unsafe-function-type */
export type StrKeyOf<T> = Extract<keyof T, string>

export type Primitive = undefined | boolean | string | number | symbol | bigint

export type NotPlainObject =
  | Primitive
  | null
  | Function
  | Date
  | RegExp
  | Error
  | ReadonlyArray<any>
  | ReadonlySet<any>
  | ReadonlyMap<any, any>

export type PropType<T, Path extends string[]> = Path extends [infer K]
  ? K extends keyof T
    ? T[K]
    : T extends ReadonlyArray<any>
      ? K extends `${number}`
        ? T[number]
        : unknown
      : unknown
  : Path extends [infer K, ...infer R]
    ? R extends string[]
      ? K extends keyof T
        ? PropType<T[K], R>
        : T extends ReadonlyArray<any>
          ? K extends `${number}`
            ? PropType<T[number], R>
            : unknown
          : unknown
      : unknown
    : unknown
