/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react';

export type NavigationGuardRequestDiscard = (action: () => void) => boolean;

export type NavigationGuardState = {
  readonly dirty: boolean;
  readonly saving: boolean;
  readonly requestDiscard: NavigationGuardRequestDiscard | null;
};

export const CLEAN_NAVIGATION_GUARD: NavigationGuardState = {
  dirty: false,
  saving: false,
  requestDiscard: null,
};

type NavigationGuardContextValue = {
  readonly guard: NavigationGuardState;
  readonly setGuard: (guard: NavigationGuardState) => void;
};

const NavigationGuardContext =
  createContext<NavigationGuardContextValue | null>(null);

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const [guard, setGuard] = useState<NavigationGuardState>(
    CLEAN_NAVIGATION_GUARD,
  );
  const value = useMemo(() => ({ guard, setGuard }), [guard]);
  return (
    <NavigationGuardContext.Provider value={value}>
      {children}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  return useContext(NavigationGuardContext)?.guard ?? CLEAN_NAVIGATION_GUARD;
}

export function useSetNavigationGuard() {
  return useContext(NavigationGuardContext)?.setGuard ?? noopSetGuard;
}

function noopSetGuard() {}
