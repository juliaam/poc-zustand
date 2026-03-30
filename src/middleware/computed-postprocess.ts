import { meta } from '@dhmk/zustand-lens'

const prefix = '$$_computed'
let prefixCounter = 0

type ComputeFunctionType<StoreType, T> = (store: StoreType) => T

// Mesma API de compute
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

/**
 * Aplica computed functions encontradas nas entries do estado.
 * Usado internamente pelo postprocess.
 */
function applyLocalComputed(state: any): Record<string, any> {
  const computedFunctions = Object.entries(state)
    .filter(([k]) => k.startsWith(prefix))
    .map(([, v]) => v as (s: any) => any)

  if (computedFunctions.length === 0) return {}

  const result = computedFunctions.reduce(
    (acc, fn) => Object.assign(acc, fn(acc)),
    { ...state },
  )

  // Retornar apenas as chaves novas (não-computed) que foram geradas
  const newKeys: Record<string, any> = {}
  for (const [k, v] of Object.entries(result)) {
    if (!k.startsWith(prefix) && !(k in state && state[k] === v)) {
      newKeys[k] = v
    }
  }
  return newKeys
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
      postprocess(state: any) {
        return applyLocalComputed(state)
      },
    },
  }
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
      postprocess(state: any) {
        // Para root, podemos acessar o get global para cross-lens
        void rootGet
        return applyLocalComputed(state)
      },
    },
  }
}
