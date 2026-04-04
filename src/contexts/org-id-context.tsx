"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "votrix-builder.org-id";

const defaultOrgId =
  typeof process.env.NEXT_PUBLIC_ORG_ID === "string"
    ? process.env.NEXT_PUBLIC_ORG_ID
    : "";

type OrgIdContextValue = {
  orgId: string;
  setOrgId: (id: string) => void;
};

const OrgIdContext = createContext<OrgIdContextValue | null>(null);

export function OrgIdProvider({ children }: { children: React.ReactNode }) {
  const [orgId, setOrgIdState] = useState(defaultOrgId);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)?.trim();
      if (stored) setOrgIdState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const setOrgId = useCallback((id: string) => {
    const trimmed = id.trim();
    const next = trimmed || defaultOrgId;
    setOrgIdState(next);
    try {
      if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ orgId, setOrgId }),
    [orgId, setOrgId]
  );

  return (
    <OrgIdContext.Provider value={value}>{children}</OrgIdContext.Provider>
  );
}

export function useOrgId(): OrgIdContextValue {
  const ctx = useContext(OrgIdContext);
  if (!ctx) {
    throw new Error("useOrgId must be used within OrgIdProvider");
  }
  return ctx;
}
