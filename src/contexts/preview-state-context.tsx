"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";
import type { SessionSummary } from "@/lib/preview-sessions-api";

export type PreviewPersistedState = {
  agentId: string;
  userIdInput: string;
  activeUserId: string | null;
  activeSessionId: string | null;
  sessionList: SessionSummary[];
  showTrace: boolean;
};

type PreviewStateContextValue = {
  getState: () => PreviewPersistedState | null;
  setState: (s: PreviewPersistedState) => void;
};

const PreviewStateContext = createContext<PreviewStateContextValue | null>(null);

export function PreviewStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ref so that saving preview state never triggers re-renders in the layout.
  const stateRef = useRef<PreviewPersistedState | null>(null);

  const getState = useCallback(() => stateRef.current, []);
  const setState = useCallback((s: PreviewPersistedState) => {
    stateRef.current = s;
  }, []);

  const value = useMemo(() => ({ getState, setState }), [getState, setState]);

  return (
    <PreviewStateContext.Provider value={value}>
      {children}
    </PreviewStateContext.Provider>
  );
}

export function usePreviewState(): PreviewStateContextValue {
  const ctx = useContext(PreviewStateContext);
  if (!ctx) {
    throw new Error("usePreviewState must be used within PreviewStateProvider");
  }
  return ctx;
}
