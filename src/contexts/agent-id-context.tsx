"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "votrix-builder.agent-id";

const defaultAgentId =
  typeof process.env.NEXT_PUBLIC_AGENT_ID === "string"
    ? process.env.NEXT_PUBLIC_AGENT_ID
    : "";

type AgentIdContextValue = {
  agentId: string;
  setAgentId: (id: string) => void;
};

const AgentIdContext = createContext<AgentIdContextValue | null>(null);

export function AgentIdProvider({ children }: { children: React.ReactNode }) {
  const [agentId, setAgentIdState] = useState(defaultAgentId);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)?.trim();
      if (stored) setAgentIdState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const setAgentId = useCallback((id: string) => {
    const trimmed = id.trim();
    const next = trimmed || defaultAgentId;
    setAgentIdState(next);
    try {
      if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ agentId, setAgentId }),
    [agentId, setAgentId]
  );

  return (
    <AgentIdContext.Provider value={value}>{children}</AgentIdContext.Provider>
  );
}

export function useAgentId(): AgentIdContextValue {
  const ctx = useContext(AgentIdContext);
  if (!ctx) {
    throw new Error("useAgentId must be used within AgentIdProvider");
  }
  return ctx;
}
