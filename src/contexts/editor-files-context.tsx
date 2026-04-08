"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAgentId } from "@/contexts/agent-id-context";
import { fetchTree, fetchAllContents } from "@/api/agent";
import type { TreeViewItem } from "@/components/tree-view";
import { buildNestedTree } from "@/lib/agent-tree";

type EditorFilesContextValue = {
  fileTree: TreeViewItem[];
  fileContents: Record<string, string>;
  setFileContents: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  removePaths: (paths: string[]) => void;
  loading: boolean;
  reload: () => Promise<void>;
};

const EditorFilesContext = createContext<EditorFilesContextValue | null>(
  null
);

export function EditorFilesProvider({ children }: { children: React.ReactNode }) {
  const { agentId } = useAgentId();
  const [fileTree, setFileTree] = useState<TreeViewItem[]>([]);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const removePaths = useCallback((paths: string[]) => {
    if (paths.length === 0) return;

    const shouldRemove = (id: string) =>
      paths.some((path) => id === path || id.startsWith(path + "/"));

    const pruneTree = (items: TreeViewItem[]): TreeViewItem[] =>
      items
        .filter((item) => !shouldRemove(item.id))
        .map((item) => ({
          ...item,
          children: item.children ? pruneTree(item.children) : undefined,
        }));

    setFileTree((prev) => pruneTree(prev));
    setFileContents((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([id]) => !shouldRemove(id))
      )
    );
  }, []);

  const reload = useCallback(async () => {
    if (!agentId.trim()) return;
    try {
      const treeData = await fetchTree(agentId);
      setFileTree(buildNestedTree(treeData));
      const contents = await fetchAllContents(agentId, treeData);
      setFileContents(contents);
    } catch (err) {
      console.error("Failed to load agent files:", err);
    }
  }, [agentId]);

  useEffect(() => {
    if (!agentId.trim()) {
      setFileTree([]);
      setFileContents({});
      setLoading(false);
      return;
    }
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [agentId, reload]);

  const value = useMemo(
    () => ({
      fileTree,
      fileContents,
      setFileContents,
      removePaths,
      loading,
      reload,
    }),
    [fileTree, fileContents, loading, reload, removePaths]
  );

  return (
    <EditorFilesContext.Provider value={value}>
      {children}
    </EditorFilesContext.Provider>
  );
}

export function useEditorFiles(): EditorFilesContextValue {
  const ctx = useContext(EditorFilesContext);
  if (!ctx) {
    throw new Error("useEditorFiles must be used within EditorFilesProvider");
  }
  return ctx;
}
