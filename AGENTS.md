# AGENTS.md

Guide for AI coding agents operating in this repository.

## Project Overview

Proof-of-concept exploring compatibility between a custom `computed` middleware
(based on zustand-computed-state) and `@dhmk/zustand-lens` for nested Zustand stores.

**Stack:** React 19 | TypeScript 5.9 | Zustand 5 | @dhmk/zustand-lens 5 | Vite 8 | pnpm

## Build / Lint / Test Commands

```bash
pnpm dev          # Start Vite dev server
pnpm build        # Type-check (tsc -b) then Vite production build
pnpm lint         # ESLint (flat config v9) across all .ts/.tsx files
pnpm preview      # Preview production build locally
```

**No test runner is configured.** There are no vitest/jest dependencies or test scripts.
If a test runner is added later (likely Vitest), expect:

```bash
pnpm test                        # Run all tests
pnpm test -- path/to/file.test   # Run a single test file
pnpm test -- -t "test name"      # Run a single test by name
```

**Type-checking only** (no emit):

```bash
npx tsc -b                       # Full project type-check via project references
```

## Code Style Guidelines

### Imports

- **Named imports** for all code modules. Default imports only for assets and config files.
- **Inline `type` keyword** for type-only imports: `import { type ReactNode } from 'react'`
  (enforced by `verbatimModuleSyntax: true` in tsconfig).
- **Relative paths** only (`./`, `../`). No path aliases are configured.
- **CSS as bare side-effect imports**: `import './App.css'`
- **Ordering:**
  1. External packages (`react`, `zustand`, `@dhmk/zustand-lens`)
  2. Internal modules (relative paths)
  3. CSS / side-effect imports (last)

### Formatting

- No Prettier is configured. Follow existing code style:
  - 2-space indentation
  - Single quotes for strings
  - No trailing semicolons (semicolons are omitted)
  - Trailing commas in multiline structures

### TypeScript

- **`type` keyword exclusively** -- never use `interface`.
- **Strict mode** is enabled with `noUnusedLocals` and `noUnusedParameters`.
- Target: ES2023 with DOM libs.
- **Type suffixes:**
  - `*State` for lens slice types (`CounterState`, `TodoState`)
  - `*Slice` for flat store slices (`CounterSlice`, `TodoSlice`)
  - `*Store` for root store types (`RootStore`, `FlatStore`)
  - `*Props` for component props (`StorePanelProps`)
  - `*Type` for utility/generic types (`ComputeFunctionType`)
- **Colocate types** with the file that consumes them. No shared `types/` directory.
- Prefer `as const` for literal arrays/objects. Minimize `as any` to middleware internals only.

### Components

- **Function declarations** for components: `function App() {}`, not arrow functions.
- **No `React.FC`** -- type props via parameter destructuring:
  ```tsx
  type FooProps = { title: string; children: ReactNode }
  export function Foo({ title, children }: FooProps) { ... }
  ```
- Define prop types immediately above the component that uses them.
- Use fragments (`<>...</>`) when no wrapper element is needed.
- Inline arrow functions for simple event handlers.

### Naming Conventions

| Item                 | Convention     | Example                          |
|----------------------|----------------|----------------------------------|
| Component files      | PascalCase     | `StorePanel.tsx`, `ApproachA.tsx` |
| Store files          | kebab-case     | `store-flat.ts`, `store-approach-a.ts` |
| Middleware files     | kebab-case     | `computed-original.ts`           |
| Components           | PascalCase     | `function StorePanel()`          |
| Zustand hooks        | `use` + Pascal | `useFlatStore`, `useStoreA`      |
| Types                | PascalCase     | `CounterState`, `RootStore`      |
| Variables/functions  | camelCase      | `activeTab`, `applyComputedState`|
| CSS classes          | kebab-case     | `.store-panel`, `.counter`       |
| Internal keys        | `$$_` prefix   | `$$_computed_doubleCount`        |

### Exports

- **Named exports** for all stores, components, and middleware functions.
- **`export default`** only for the root `App` component and config files (vite, eslint).

### File Organization

```
src/
  middleware/     # Zustand middleware variants (computed-*.ts)
  stores/        # Zustand store definitions (store-*.ts)
  components/    # React UI components (PascalCase.tsx)
  assets/        # Static images
  App.tsx        # Root component (default export)
  App.css        # Root component styles
  main.tsx       # Entry point
  index.css      # Global styles and CSS custom properties
```

**Planned store files:**

| File | Description |
|------|-------------|
| `store-flat.ts` | Flat baseline (2 services, demonstrates name collision) |
| `store-approach-a.ts` | withLenses + computed-recursive |
| `store-approach-b.ts` | withLenses + meta.postprocess |
| `store-approach-c.ts` | withLenses + computedLens factory |
| `store-global-flat.ts` | Flat global store mirroring real `useApp` (3 services, `CombinedServices`, `GlobalService<T>`) |
| `store-global-a.ts` | Global store migrated to lenses — approach A |
| `store-global-b.ts` | Global store migrated to lenses — approach B |
| `store-global-c.ts` | Global store migrated to lenses — approach C |

- **Role-based directories**, not feature-based.
- **Flat structure** within each directory -- no nesting.
- **No barrel files** (`index.ts`) -- import each module by its full path.

### Zustand Patterns

- Always use the double-invocation pattern for type inference: `create<T>()(...)`.
- Lensed stores: `create<T>()(computed(withLenses(...)))`.
- Flat stores: `create<T>()(computed((...a) => ({ ...sliceA(...a), ...sliceB(...a) })))`.
- Define actions inline within the store using `set`/`get` from the closure.
- Use the partial-object form of `set`: `set({ count: get().count + 1 })`.
- Export a single hook per store: `export const useStoreA = create<RootStore>()(...)`.
- Consume stores without selectors: `const store = useStoreA()`.

### Styling

- **Plain CSS** with CSS custom properties (no Tailwind, CSS modules, or CSS-in-JS).
- Global tokens defined on `:root` in `index.css`.
- Native CSS nesting syntax (`& > div`, `&:hover`).
- Dark mode via `@media (prefers-color-scheme: dark)` and variable overrides.
- Simple descriptive class names -- no BEM methodology.

### Error Handling

- This is a POC with minimal error handling.
- Rely on TypeScript strict mode for compile-time safety.
- Use `console.log` with bracketed prefixes for debugging: `console.log('[Counter] increment')`.
- Non-null assertion (`!`) is acceptable for DOM element lookups in `main.tsx`.

### ESLint

- ESLint v9 flat config (`eslint.config.js`).
- Extends: `@eslint/js` recommended, `typescript-eslint` recommended,
  `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`.
- Only lints `**/*.{ts,tsx}` files. `dist/` is globally ignored.
- Run `pnpm lint` before committing. Fix all warnings and errors.

## Key Reference

The `PLAN.md` file (1049 lines) contains the complete implementation plan with full
code listings for all middleware variants, stores, and components. Consult it for
architectural decisions and intended file contents before writing new code.
