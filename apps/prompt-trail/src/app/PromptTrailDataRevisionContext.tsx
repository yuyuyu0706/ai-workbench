import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface PromptTrailDataRevisionContextValue {
  readonly revision: number;
  notifyDataChanged(): void;
}

const defaultValue: PromptTrailDataRevisionContextValue = {
  revision: 0,
  notifyDataChanged() {},
};

const PromptTrailDataRevisionContext =
  createContext<PromptTrailDataRevisionContextValue>(defaultValue);

export function PromptTrailDataRevisionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [revision, setRevision] = useState(0);
  const notifyDataChanged = useCallback(() => {
    setRevision((currentRevision) => currentRevision + 1);
  }, []);
  const value = useMemo(
    () => ({ revision, notifyDataChanged }),
    [notifyDataChanged, revision],
  );

  return (
    <PromptTrailDataRevisionContext.Provider value={value}>
      {children}
    </PromptTrailDataRevisionContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- This hook is the public Context access point for UI code.
export function usePromptTrailDataRevision() {
  return useContext(PromptTrailDataRevisionContext);
}
