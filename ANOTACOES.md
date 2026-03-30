Verificar se dá pra utilizar o lens + computed dessa forma

```
import { create } from 'zustand';
import { withLenses, lens } from '@dhmk/zustand-lens';
// Assumindo um middleware computed padrão da comunidade (ex: zustand-computed)
import computed from 'zustand-computed';

// Tipos isolados para a fatia
type AuthState = {
user: { name: string; role: 'admin' | 'user' } | null;
login: (name: string) => void;
};

// Tipos isolados para o que é computado
type AuthComputed = {
isAdmin: boolean;
isLoggedIn: boolean;
};

export const useApp = create<{ auth: AuthState & AuthComputed }>()(
withLenses(() => ({

    // O computed abraça APENAS o interior do lens do Auth
    auth: lens(
      computed<AuthState, AuthComputed>(
        (set) => ({
          user: null,
          login: (name) => set({ user: { name, role: 'admin' } }),
        }),
        // Função que calcula os estados derivados baseados no estado do auth
        (state) => ({
          isAdmin: state.user?.role === 'admin',
          isLoggedIn: state.user !== null,
        })
      )
    ),

}))
);

// Uso no componente (o TypeScript vai auto-completar perfeitamente):
// const isAdmin = useApp(state => state.auth.isAdmin);
```
