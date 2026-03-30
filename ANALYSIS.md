# Análise Comparativa das Abordagens de `computed` + `@dhmk/zustand-lens`

## O Problema Central

O middleware `computed` original (`computed-original.ts`) funciona assim: quando qualquer `set()` é chamado, ele intercepta, monta o novo estado, e procura por chaves com prefixo `$$_computed` **apenas no nível raiz** via `Object.entries(state)`. Quando usado com `withLenses`, os lenses encapsulam o estado dos slices em sub-objetos (`state.counter`, `state.todo`), então as chaves `$$_computed_*` ficam **aninhadas dentro deles** e nunca são encontradas pelo `Object.entries` do nível raiz.

O fluxo problemático:
1. Lens chama `set({count: 1})`
2. O lens internamente traduz isso para `parentSet({ counter: { ...counter, count: 1 } })`
3. O `setWithComputed` do middleware recebe isso e faz `Object.entries(newState)` — vê apenas `counter`, `todo` como chaves
4. Nenhuma chave `$$_computed_*` é encontrada no raiz, então os computeds **nunca executam**

As três abordagens tentam resolver isso de formas diferentes.

---

## Baseline: Store Flat (`computed-original.ts` + `store-flat.ts`)

### Como funciona

O `computed-original.ts` define duas peças:

**1. A função `compute()`** — um "marker" que gera chaves especiais no estado:

```ts
// compute('counterDouble', get, fn) retorna:
// { '$$_computed_counterDouble': fn }
```

Quando espalhado no objeto do store, isso injeta uma chave "invisível" que contém a função de cálculo. A função `compute` tem duas overloads: com ID explícito (`compute('nome', get, fn)`) ou sem (`compute(get, fn)` — gera um ID auto-incrementado via `prefixCounter++`).

**2. O middleware `computed`** — intercepta o `set`:

Em `injectComputedMiddleware`:
- Substitui o `set` original por `setWithComputed`, que a cada chamada:
  1. Monta o novo estado com `Object.assign({}, state, updated)`
  2. Chama `applyComputedState` que filtra todas as entries com prefixo `$$_computed`, extrai as funções, e executa cada uma em sequência via `reduce`
  3. O resultado de cada função é mergeado no estado via `Object.assign`
- Também substitui `api.setState` para cobrir chamadas externas
- Aplica `applyComputedState` no estado inicial retornado pelo `f(setWithComputed, get, api)`

**No store flat** (`store-flat.ts`), tudo vive no mesmo nível:

```ts
computed((...a) => ({
  ...createCounterService(...a),   // spread do counter
  ...createTodoService(...a),      // spread do todo (sobrescreve reset/isLoading!)
  ...compute('summary', a[1], fn), // computed cross-service
}))
```

### Pontos positivos
- Simples, direto, funciona bem para stores flat
- Os computed rodam tanto na inicialização quanto em cada `set`
- Cross-service computed funciona naturalmente (tudo está no mesmo nível)

### Problemas
- **Colisão de nomes**: `reset()` e `isLoading` existem em Counter e Todo. Como ambos são espalhados no mesmo nível, o **último spread vence**. No caso, `createTodoService` é o último, então `store.reset()` sempre executa o reset do Todo, nunca do Counter. Isso é o bug fundamental que motivou toda a POC.
- **Escalabilidade zero**: com 3+ services (como no `store-global-flat.ts`), o problema piora — `reset()` do Auth é sobrescrito pelo Counter, que é sobrescrito pelo Todo.
- **Computed recebe o store inteiro**: cada função compute recebe `FlatStore` completo, mesmo quando é "local" a um service. Sem encapsulamento.

---

## Abordagem A: Computed Recursivo (`computed-recursive.ts`)

### Como funciona

A mudança central está em `applyComputedState`:

```ts
function applyComputedState(state: any): any {
  const processed = { ...state }

  // Passo 1: recursão nos filhos
  for (const [key, value] of Object.entries(processed)) {
    if (isPlainObject(value) && !key.startsWith(prefix)) {
      processed[key] = applyComputedState(value)
    }
  }

  // Passo 2: aplica computed do nível atual
  const computedFunctions = Object.entries(processed)
    .filter(([k]) => k.startsWith(prefix))
    .map(([, v]) => v as (state: any) => any)

  return computedFunctions.reduce(
    (acc, fn) => Object.assign(acc, fn(acc)),
    processed,
  )
}
```

**O `isPlainObject`** é uma guarda importante — verifica se o valor é um objeto literal (protótipo === `Object.prototype`). Isso evita que arrays, Date, RegExp, ou instâncias de classe sejam tratados como "slices aninhados". A checagem `!key.startsWith(prefix)` previne que uma chave `$$_computed_*` (que contém uma função) seja processada recursivamente.

**A ordem é crítica**: filhos primeiro, depois o nível atual. Isso garante que quando o computed cross-lens no root executa (ex: `summary`), os computed locais dos lenses (ex: `doubleCount`, `totalTodos`) **já foram calculados**. Se fosse invertido, `summary` leria `doubleCount: 0` em vez do valor correto.

**No `setWithComputed`**, o middleware continua interceptando o `set` da mesma forma que o original, mas agora cada chamada executa a recursão completa:

1. Lens `counter` chama `set({count: 1})`
2. `zustand-lens` traduz para `parentSet({ counter: { ...counterState, count: 1 } })`
3. `setWithComputed` recebe isso, monta `newState = { counter: {...}, todo: {...}, ... }`
4. `applyComputedState(newState)` desce recursivamente:
   - Entra em `counter` → acha `$$_computed_doubleCount`, executa, produz `doubleCount: 2`
   - Entra em `todo` → acha seus computed, reexecuta (mesmo sem mudança)
   - Volta ao root → acha `$$_computed_summary`, executa com o estado já atualizado

**Na store** (`store-approach-a.ts`), a composição é `computed(withLenses(...))` — o middleware `computed` envolve `withLenses`, interceptando o `set` no nível mais externo.

### Pontos positivos
- **Transparente**: a API de uso é idêntica ao `computed` original. Basta trocar o import.
- **Computed funciona na inicialização E em updates**: sem necessidade de valores iniciais manuais.
- **Computed local recebe estado local**: dentro do lens `counter`, o `compute('doubleCount', get, fn)` recebe `CounterState`, não `RootStore`. Isso é natural porque o `get` passado é o getter do lens.
- **Cross-lens funciona nativamente**: o `compute('summary', get, fn)` no root recebe `RootStore` completa (com computed dos filhos já calculados).
- **Sem boilerplate extra**: não precisa de `...computedMeta()` ou factory especial.
- **Composição limpa**: `create<T>()(computed(withLenses(...)))`.

### Problemas
- **Performance**: a cada `set()` em qualquer lens, TODA a árvore é percorrida recursivamente. Para uma POC com 2-3 levels e poucos slices é irrelevante, mas em stores grandes com muitos lenses aninhados, isso pode ser custoso. Cada `set` no counter recomputa os computed do todo também, desnecessariamente.
- **`isPlainObject` pode falhar em edge cases**: se algum valor no estado for um objeto literal comum (ex: um objeto config `{ theme: 'dark' }`), será tratado como slice e processado recursivamente. Pode causar efeitos colaterais inesperados.
- **Objetos são clonados a cada `set`**: `const processed = { ...state }` cria cópias novas de cada nível mesmo que nada tenha mudado, o que pode causar re-renders desnecessários em React (referência nova = componente re-renderiza).

---

## Abordagem B: `meta.postprocess` (`computed-postprocess.ts`)

### Como funciona

Esta abordagem abandona completamente a ideia de um middleware `computed` externo. Em vez disso, usa o mecanismo nativo do `@dhmk/zustand-lens`: o símbolo `[meta]` com a propriedade `postprocess`.

**Como `postprocess` funciona no zustand-lens**: quando um lens executa `set(partial)`, o zustand-lens, após aplicar o partial no estado do lens, verifica se o lens tem um `[meta].postprocess`. Se sim, chama `postprocess(novoEstado, estadoAnterior)` e faz merge do resultado no estado. Isso é um hook nativo do zustand-lens.

**`applyLocalComputed`**:
```ts
function applyLocalComputed(state: any): Record<string, any> {
  // 1. Acha todas as funções $$_computed_* no estado
  const computedFunctions = Object.entries(state)
    .filter(([k]) => k.startsWith(prefix))
    .map(([, v]) => v as (s: any) => any)

  if (computedFunctions.length === 0) return {}

  // 2. Executa todas sobre o estado
  const result = computedFunctions.reduce(
    (acc, fn) => Object.assign(acc, fn(acc)),
    { ...state },
  )

  // 3. Retorna APENAS as chaves novas/alteradas (não as $$_computed_* nem as iguais)
  const newKeys: Record<string, any> = {}
  for (const [k, v] of Object.entries(result)) {
    if (!k.startsWith(prefix) && !(k in state && state[k] === v)) {
      newKeys[k] = v
    }
  }
  return newKeys
}
```

A diferença sutil: retorna apenas o **diff** (chaves novas ou com valor diferente), não o estado completo. Isso é porque `postprocess` faz merge parcial — se retornasse tudo, poderia sobrescrever valores indevidamente.

**`computedMeta()`** — gera o objeto `[meta]` para incluir dentro de cada lens:
```ts
export function computedMeta() {
  return {
    [meta]: {
      postprocess(state: any) {
        return applyLocalComputed(state)
      },
    },
  }
}
```

**`computedRootMeta(get)`** — mesma coisa mas para o nível root do `withLenses`. Recebe o `rootGet` mas no código atual não o usa diretamente (o `void rootGet` é só para evitar warning de variável não utilizada).

**Na store** (`store-approach-b.ts`), a composição é `create<T>()(withLenses(...))` — **sem o middleware `computed` externo**. Cada lens inclui manualmente:
1. As chamadas `compute(...)` com cast `as Record<string, unknown>` para contornar problemas de tipagem
2. Valores iniciais explícitos (`doubleCount: 0`, `isPositive: false`)
3. `...computedMeta()` no final

### Pontos positivos
- **Usa API nativa do zustand-lens**: não precisa de middleware externo, o `postprocess` é o mecanismo oficial.
- **Cada lens é independente**: o postprocess de um lens só roda quando aquele lens muda. Se `counter` faz `set`, o postprocess do `todo` não é executado.
- **Sem recursão sobre toda a árvore**: mais eficiente que a Abordagem A em termos de escopo de execução.

### Problemas
- **`postprocess` NÃO roda na inicialização**: esta é a desvantagem mais significativa. Quando o store é criado, os computed não são calculados automaticamente. Por isso é necessário fornecer valores iniciais manuais:
  ```ts
  doubleCount: 0,    // tem que escrever isso manualmente
  isPositive: false, // e isso também
  ```
  Isso é propenso a bugs: se a lógica do computed mudar, o valor inicial pode ficar dessincronizado.
- **Boilerplate significativo**: cada lens precisa de:
  1. `...compute(...)` com cast para `Record<string, unknown>`
  2. Valores iniciais manuais para cada computed
  3. `...computedMeta()` explícito
  Repetitivo e fácil de esquecer.
- **Cross-lens computed no root tem o mesmo problema**: `summary: ''` é o valor manual, e só atualiza no primeiro `set` de qualquer lens.
- **Cast `as Record<string, unknown>`**: necessário em vários lugares porque o TypeScript não consegue inferir o tipo do spread de `compute()` dentro do objeto tipado do lens. Isso polui o código.

---

## Abordagem C: `computedLens` Factory (`computed-lens-factory.ts`)

### Como funciona

A ideia é criar uma factory `computedLens<T>()` que substitui `lens<T>()` e encapsula toda a lógica de computed + postprocess internamente.

**`computedLens`**:
```ts
export function computedLens<T, S = unknown>(fn) {
  return lens<T, S>((set, get, api, ctx) => {
    // 1. Wrapper de set (na prática, não altera o set — usa postprocess)
    const originalSet = set
    const computedSet: Setter<T> = (partial, replace, ...args) => {
      originalSet(partial, replace, ...args)
    }

    // 2. Executa a fn do usuário para obter o estado
    const state = fn(computedSet, get, api, ctx)

    // 3. Aplica computed na inicialização
    const initialComputed = applyComputedToObject(state)

    // 4. Injeta [meta].postprocess para updates futuros
    return {
      ...initialComputed,
      [meta]: {
        postprocess(newState, prevState, ...args) {
          const withComputed = applyComputedToObject(newState)
          const diff = {}
          for (const [k, v] of Object.entries(withComputed)) {
            if (!k.startsWith(prefix) && newState[k] !== v) {
              diff[k] = v
            }
          }
          const existingResult = existingPostprocess?.(newState, prevState, ...args)
          return { ...diff, ...existingResult }
        },
      },
    }
  })
}
```

**Passo a passo**:
1. O `computedSet` é criado como wrapper do `set`, mas na implementação atual **não faz nada diferente** — simplesmente delega para `originalSet`. O wrapper existe como preparação caso se queira interceptar o `set` no futuro.
2. A `fn` do usuário é chamada, retornando o objeto de estado completo (com chaves `$$_computed_*` espalhadas).
3. `applyComputedToObject` encontra todas as funções `$$_computed_*`, executa-as, e retorna o estado com os valores computed calculados. Isso resolve o problema da inicialização que a Abordagem B tem.
4. Um `[meta].postprocess` é injetado automaticamente. A cada `set`, ele:
   - Recalcula os computed via `applyComputedToObject`
   - Calcula o diff (o que mudou)
   - Se havia um postprocess pré-existente (do usuário), executa-o também e mergea
   - Retorna o diff para o zustand-lens aplicar

**`computeRoot`** — helper para computed cross-lens no root:
```ts
export function computeRoot<T>(id, get, fn): Partial<T> {
  void get  // ignora o get (não é usado)
  return { [`${prefix}_${id}`]: fn } as any
}
```

Simplesmente cria a chave `$$_computed_*` no nível root. Mas atenção: **não há mecanismo para executá-la**. O `computeRoot` gera o marker, mas quem vai processá-lo? No root do `withLenses`, não há `computedLens` nem `computedMeta`. O `withLenses` não sabe sobre `$$_computed_*`.

### Pontos positivos
- **API limpa para os lenses**: basta trocar `lens<T>` por `computedLens<T>`. Sem necessidade de `computedMeta()`, sem valores iniciais manuais.
- **Computed funciona na inicialização**: o `applyComputedToObject(state)` é chamado na construção do lens.
- **Composição com postprocess existente**: se o usuário já tiver um `[meta].postprocess` próprio, o factory o preserva e executa em cadeia.
- **Escopo local**: como a Abordagem B, cada lens processa apenas seus próprios computed no `set`.

### Problemas
- **Cross-lens computed NO ROOT NÃO FUNCIONA**: esta é a falha mais crítica. O `computeRoot('summary', get, fn)` gera `{ $$_computed_summary: fn }` no nível root do `withLenses`, mas:
  - Não há middleware `computed` envolvendo o `withLenses` (diferente da Abordagem A)
  - Não há `computedMeta()` no root (diferente da Abordagem B)
  - O `computeRoot` não injeta nenhum `[meta].postprocess`

  Resultado: `$$_computed_summary` fica no estado como uma propriedade morta. O `summary` é inicializado com `''` e **nunca atualiza**. Para funcionar, seria necessário combinar com a Abordagem A (`computed(withLenses(...))`) ou adicionar manualmente um `[meta].postprocess` no root.

- **O wrapper `computedSet` não serve para nada**: o código cria um wrapper que simplesmente delega para o `originalSet`. Não agrega valor. É código morto na prática.
- **`applyComputedToObject` roda a cada `set`**: embora tenha escopo local (só o lens atual), ele reexecuta TODOS os computed do lens mesmo que apenas uma propriedade tenha mudado.
- **Tipagem com `as T & LensMeta<T, S>`**: o retorno precisa de cast explícito porque o `[meta]` não faz parte do tipo `T`. Funciona mas é um truque.

---

## Comparação Direta

| Critério | Flat (Baseline) | A (Recursivo) | B (postprocess) | C (Factory) |
|---|---|---|---|---|
| Resolve colisão de nomes | Não | Sim | Sim | Sim |
| Computed na inicialização | Sim | Sim | **Não** | Sim |
| Computed em updates | Sim | Sim | Sim | Sim |
| Cross-lens computed | Sim | Sim | Sim | **Não** (quebrado) |
| Requer boilerplate extra | Não | Não | Muito | Pouco |
| Performance por `set` | O(n) flat | O(toda árvore) | O(lens local) | O(lens local) |
| Middleware externo | Sim | Sim | Não | Não |
| API nativa zustand-lens | Não usa | Não usa | `[meta].postprocess` | `[meta].postprocess` |
| Dificuldade de migração | N/A (atual) | Baixa | Alta | Média |
| Cast de tipagem necessário | Não | Não | Sim (vários) | Sim (retorno) |

---

## Resumo por Abordagem

**Abordagem A** é a mais completa: funciona em todos os cenários, tem a API mais simples para o consumidor, e a migração é trivial (trocar import do `computed`). O tradeoff é performance — recalcula tudo a cada `set`. Para o caso de uso real (poucos services, poucos computed), isso é irrelevante.

**Abordagem B** é a mais "correta" do ponto de vista de usar APIs nativas, mas a mais penosa de usar. A necessidade de valores iniciais manuais é um footgun real em produção (valores dessincronizados). O boilerplate com `computedMeta()` + casts + valores iniciais torna cada lens ~40% mais verboso.

**Abordagem C** é uma boa ideia mal finalizada. Resolve elegantemente o computed local nos lenses, mas falha no caso mais importante: cross-lens computed. Sem um mecanismo para processar `$$_computed_*` no root do `withLenses`, o `summary` nunca atualiza. Precisa ser complementada (com A ou B no root) para funcionar completamente.

Se tivesse que escolher uma para produção: **Abordagem A**, com uma otimização futura opcional de memoização/dirty-checking para evitar reprocessar lenses que não mudaram.
