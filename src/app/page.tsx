"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import TreeView from "@/components/tree-view";
import type { TreeViewItem, TreeViewMenuItem } from "@/components/tree-view";
import Editor from "@/components/editor";
import {
  Folder,
  FileText,
  FileCode,
  FileJson,
  Image,
  FileType,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
  Scissors,
  Copy,
  ClipboardCopy,
  X,
  Code2,
  GitBranch,
  Bell,
  Loader2,
  BookOpen,
  Sparkles,
  Wrench,
  Save,
  Check,
} from "lucide-react";
import {
  fetchTree,
  fetchAllContents,
  saveFile as apiSaveFile,
  createDirectory,
  moveFile,
  bulkMove,
  copyFile,
  bulkDelete,
} from "@/api/agent";
import type { ApiTreeEntry } from "@/api/agent";

function getFileType(name: string, fileClass: string): string {
  if (fileClass === "skill") return "skill";
  if (fileClass === "prompt") return "prompt";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "json") return "json";
  if (ext === "md") return "md";
  if (ext === "ts" || ext === "tsx") return "tsx";
  if (ext === "js" || ext === "jsx") return "js";
  if (ext === "css") return "css";
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) return "image";
  return "file";
}

function buildNestedTree(entries: ApiTreeEntry[]): TreeViewItem[] {
  const dirMap = new Map<string, TreeViewItem>();

  // Create nodes for all directories first
  for (const entry of entries) {
    if (entry.type === "directory") {
      dirMap.set(entry.path, {
        id: entry.path,
        name: entry.name,
        type: "folder",
        children: [],
      });
    }
  }

  const roots: TreeViewItem[] = [];

  for (const entry of entries) {
    if (entry.type === "directory") continue;

    const node: TreeViewItem = {
      id: entry.path,
      name: entry.name,
      type: getFileType(entry.name, entry.file_class),
    };

    // Find parent directory
    const parentPath = entry.path.substring(0, entry.path.lastIndexOf("/")) || "/";
    const parent = dirMap.get(parentPath);
    if (parent) {
      parent.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  // Attach subdirectories to parents
  for (const entry of entries) {
    if (entry.type !== "directory") continue;
    const parentPath = entry.path.substring(0, entry.path.lastIndexOf("/")) || "/";
    const parent = dirMap.get(parentPath);
    const self = dirMap.get(entry.path)!;
    if (parent && parent !== self) {
      parent.children!.push(self);
    } else if (!parent) {
      roots.push(self);
    }
  }

  return roots;
}


const iconMap: Record<string, React.ReactNode> = {
  folder: <Folder className="h-4 w-4 text-blue-500" />,
  skill: <Sparkles className="h-4 w-4 text-amber-500" />,
  prompt: <BookOpen className="h-4 w-4 text-violet-500" />,
  tsx: <FileCode className="h-4 w-4 text-sky-500" />,
  ts: <FileCode className="h-4 w-4 text-blue-600" />,
  js: <FileCode className="h-4 w-4 text-yellow-500" />,
  css: <FileType className="h-4 w-4 text-purple-500" />,
  json: <FileJson className="h-4 w-4 text-yellow-600" />,
  md: <FileText className="h-4 w-4 text-gray-500" />,
  image: <Image className="h-4 w-4 text-green-500" />,
  file: <FileText className="h-4 w-4 text-gray-400" />,
};

function getFileLanguage(id: string): string {
  if (id.endsWith(".tsx") || id.endsWith(".ts")) return "TypeScript JSX";
  if (id.endsWith(".css")) return "CSS";
  if (id.endsWith(".json")) return "JSON";
  if (id.endsWith(".md")) return "Markdown";
  return "Plain Text";
}

interface OpenTab {
  id: string;
  name: string;
  type: string;
}

export default function Home() {
  const [fileTree, setFileTree] = useState<TreeViewItem[]>([]);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState<string>("");
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const isResizing = useRef(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ghostNode, setGhostNode] = useState<{ parentId: string; type: "file" | "folder" } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ paths: string[]; names: string[] } | null>(null);
  const [pendingMove, setPendingMove] = useState<{ oldPath: string; newPath: string; name: string } | null>(null);
  const [dirtyTabs, setDirtyTabs] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveFile = useCallback(async (path: string, content: string) => {
    setSaving(true);
    try {
      await apiSaveFile(path, content);
      setDirtyTabs((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    } finally {
      setSaving(false);
    }
  }, []);

  const handleEditorChange = useCallback(
    (text: string) => {
      if (!activeTab) return;
      // Update local content
      setFileContents((prev) => ({ ...prev, [activeTab]: text }));
      // Mark tab as dirty
      setDirtyTabs((prev) => new Set(prev).add(activeTab));
      // Debounce auto-save (1 second)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const tabToSave = activeTab;
      saveTimerRef.current = setTimeout(() => {
        saveFile(tabToSave, text);
      }, 1000);
    },
    [activeTab, saveFile]
  );

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (activeTab && dirtyTabs.has(activeTab)) {
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveFile(activeTab, fileContents[activeTab] ?? "");
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTab, dirtyTabs, fileContents, saveFile]);

  const reload = useCallback(async () => {
    try {
      const treeData = await fetchTree();
      setFileTree(buildNestedTree(treeData));
      const contents = await fetchAllContents(treeData);
      setFileContents(contents);
    } catch (err) {
      console.error("Failed to load agent files:", err);
    }
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  const handleMouseDown = useCallback(() => {
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(Math.max(e.clientX, 150), 500);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  const imageExts = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "tiff"]);
  const imageItemTypes = new Set(["image"]);
  const textExts = new Set([
    "txt", "md", "csv", "tsv", "json", "xml", "yaml", "yml", "toml",
    "html", "htm", "css", "scss", "sass", "less",
    "js", "jsx", "ts", "tsx", "mjs", "cjs",
    "py", "rb", "go", "rs", "java", "kt", "c", "cpp", "h", "hpp", "cs",
    "sh", "bash", "zsh", "fish", "bat", "ps1",
    "sql", "graphql", "gql", "prisma",
    "env", "ini", "cfg", "conf", "properties",
    "log", "gitignore", "dockerignore", "editorconfig",
    "lock", "makefile", "dockerfile",
  ]);

  function getFileCategory(item: { id: string; type: string }): "text" | "image" | "binary" {
    const ext = item.id.split(".").pop()?.toLowerCase() ?? "";
    if (imageExts.has(ext) || imageItemTypes.has(item.type)) return "image";
    if (item.id in fileContents) return "text";
    if (textExts.has(ext)) return "text";
    return "binary";
  }

  function handleSelectionChange(items: TreeViewItem[]) {
    if (items.length === 0) return;
    const item = items[0];
    if (item.type === "folder") return;

    if (!openTabs.find((t) => t.id === item.id)) {
      setOpenTabs((prev) => [
        ...prev,
        { id: item.id, name: item.name, type: item.type },
      ]);
    }
    setActiveTab(item.id);
  }

  function closeTab(id: string) {
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeTab === id && next.length > 0) {
        setActiveTab(next[next.length - 1].id);
      }
      if (next.length === 0) {
        setActiveTab("");
      }
      return next;
    });
  }

  const activeContent = activeTab ? fileContents[activeTab] ?? "" : "";

  // The item id IS the full path (e.g. "/skills/booking/SKILL.md")
  function getItemPath(item: TreeViewItem): string {
    return item.id;
  }

  // Build tree data with ghost node injected
  const treeDataWithGhost = React.useMemo(() => {
    if (!ghostNode) return fileTree;

    const ghostId = `__ghost__${ghostNode.parentId}/${ghostNode.type}`;
    const ghostItem: TreeViewItem = {
      id: ghostId,
      name: "",
      type: ghostNode.type === "folder" ? "folder" : "file",
    };
    if (ghostNode.type === "folder") {
      ghostItem.children = [];
    }

    const insertGhost = (items: TreeViewItem[]): TreeViewItem[] =>
      items.map((item) => {
        if (item.id === ghostNode.parentId && item.children) {
          return { ...item, children: [ghostItem, ...item.children] };
        }
        if (item.children) {
          return { ...item, children: insertGhost(item.children) };
        }
        return item;
      });

    return insertGhost(fileTree);
  }, [fileTree, ghostNode]);

  const clipboardRef = useRef<{ paths: string[]; cut: boolean } | null>(null);

  const contextMenuItems: TreeViewMenuItem[] = [
    {
      id: "new-file",
      label: "New File",
      icon: <FilePlus className="h-4 w-4" />,
      showFor: (item) => item.type === "folder",
      action: (items) => {
        const folder = items[0];
        setGhostNode({ parentId: folder.id, type: "file" });
        setEditingId(`__ghost__${folder.id}/file`);
      },
    },
    {
      id: "new-folder",
      label: "New Folder",
      icon: <FolderPlus className="h-4 w-4" />,
      showFor: (item) => item.type === "folder",
      action: (items) => {
        const folder = items[0];
        setGhostNode({ parentId: folder.id, type: "folder" });
        setEditingId(`__ghost__${folder.id}/folder`);
      },
    },
    {
      id: "cut",
      label: "Cut",
      icon: <Scissors className="h-4 w-4" />,
      separator: true,
      action: (items) => {
        clipboardRef.current = { paths: items.map((i) => i.id), cut: true };
      },
    },
    {
      id: "copy",
      label: "Copy",
      icon: <Copy className="h-4 w-4" />,
      action: (items) => {
        clipboardRef.current = { paths: items.map((i) => i.id), cut: false };
      },
    },
    {
      id: "paste",
      label: "Paste",
      icon: <ClipboardCopy className="h-4 w-4" />,
      action: async (items) => {
        const clip = clipboardRef.current;
        if (!clip || clip.paths.length === 0) return;
        const target = items[0];
        const destFolder = target.type === "folder"
          ? target.id
          : target.id.substring(0, target.id.lastIndexOf("/"));
        if (clip.cut) {
          const moves = clip.paths.map((p) => {
            const name = p.split("/").pop()!;
            return { old_path: p, new_path: `${destFolder}/${name}` };
          });
          await bulkMove(moves);
          clipboardRef.current = null;
        } else {
          for (const p of clip.paths) {
            const name = p.split("/").pop()!;
            await copyFile(p, `${destFolder}/${name}`);
          }
        }
        await reload();
      },
    },
    {
      id: "copy-path",
      label: "Copy Path",
      icon: <ClipboardCopy className="h-4 w-4" />,
      separator: true,
      action: (items) => {
        navigator.clipboard.writeText(getItemPath(items[0]));
      },
    },
    {
      id: "copy-relative-path",
      label: "Copy Relative Path",
      icon: <ClipboardCopy className="h-4 w-4" />,
      action: (items) => {
        navigator.clipboard.writeText(getItemPath(items[0]));
      },
    },
    {
      id: "rename",
      label: "Rename",
      icon: <Pencil className="h-4 w-4" />,
      separator: true,
      action: (items) => {
        setEditingId(items[0].id);
      },
    },
    {
      id: "delete",
      label: "Delete",
      icon: <Trash2 className="h-4 w-4 text-red-500" />,
      action: (items) => {
        setPendingDelete({
          paths: items.map((i) => i.id),
          names: items.map((i) => i.name),
        });
      },
    },
  ];

  const handleEditCommit = async (id: string, newName: string) => {
    if (id.startsWith("__ghost__")) {
      // Ghost node commit — create new file or folder
      if (!ghostNode || !newName) {
        setGhostNode(null);
        setEditingId(null);
        return;
      }
      const path = `${ghostNode.parentId}/${newName}`;
      if (ghostNode.type === "file") {
        await apiSaveFile(path, "");
      } else {
        await createDirectory(path);
      }
      setGhostNode(null);
      setEditingId(null);
      await reload();
    } else {
      // Rename commit
      if (!newName || newName === id.split("/").pop()) {
        setEditingId(null);
        return;
      }
      const parentPath = id.substring(0, id.lastIndexOf("/"));
      const newPath = `${parentPath}/${newName}`;
      await moveFile(id, newPath);
      setOpenTabs((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, id: newPath, name: newName } : t
        )
      );
      if (activeTab === id) setActiveTab(newPath);
      setEditingId(null);
      await reload();
    }
  };

  const handleEditCancel = (id: string) => {
    if (id.startsWith("__ghost__")) {
      setGhostNode(null);
    }
    setEditingId(null);
  };

  // Check if a path exists in the current file tree
  const pathExists = useCallback((path: string): boolean => {
    const check = (items: TreeViewItem[]): boolean =>
      items.some((item) => item.id === path || (item.children && check(item.children)));
    return check(fileTree);
  }, [fileTree]);

  const handleMoveConfirm = async () => {
    if (!pendingMove) return;
    await moveFile(pendingMove.oldPath, pendingMove.newPath);
    setPendingMove(null);
    await reload();
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    const { paths } = pendingDelete;
    await bulkDelete(paths);
    setOpenTabs((prev) => prev.filter((t) => !paths.some((p) => t.id === p || t.id.startsWith(p + "/"))));
    setPendingDelete(null);
    await reload();
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white">
      {/* Title bar */}
      <div className="flex h-10 items-center justify-between border-b border-gray-200 bg-gray-50 px-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Code2 className="h-4 w-4 text-blue-500" />
          <span>Votrix Editor</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{process.env.NEXT_PUBLIC_AGENT_ID}</span>
          <span className="text-gray-300">|</span>
          <span>Votrix Developers</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - File Tree */}
        <div
          className="flex flex-shrink-0 flex-col border-r border-gray-200 bg-gray-50/70"
          style={{ width: sidebarWidth }}
        >
          <div className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Explorer
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                <span className="text-xs text-gray-400">Loading agent files...</span>
              </div>
            ) : (
              <TreeView
                data={treeDataWithGhost}
                iconMap={iconMap}
                showExpandAll
                className="tree-view-light"
                searchPlaceholder="Search files..."
                menuItems={contextMenuItems}
                onSelectionChange={handleSelectionChange}
                editingId={editingId}
                onEditCommit={handleEditCommit}
                onEditCancel={handleEditCancel}
                onDrop={async (dragged, target) => {
                  if (target.type !== "folder") return;
                  const newPath = `${target.id}/${dragged.name}`;
                  if (newPath === dragged.id) return; // same location
                  if (pathExists(newPath)) {
                    setPendingMove({ oldPath: dragged.id, newPath, name: dragged.name });
                    return;
                  }
                  await moveFile(dragged.id, newPath);
                  await reload();
                }}
              />
            )}
          </div>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className="w-1 flex-shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-blue-400"
        />

        {/* Editor area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Move/replace confirmation bar */}
          {pendingMove && (
            <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm">
              <Copy className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-gray-700">
                <strong>{pendingMove.name}</strong> already exists in the destination. Replace it?
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setPendingMove(null)}
                  className="rounded px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMoveConfirm}
                  className="rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
                >
                  Replace
                </button>
              </div>
            </div>
          )}
          {/* Delete confirmation bar */}
          {pendingDelete && (
            <div className="flex items-center gap-3 border-b border-red-200 bg-red-50 px-4 py-2 text-sm">
              <Trash2 className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-gray-700">
                Delete <strong>{pendingDelete.names.join(", ")}</strong>?
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setPendingDelete(null)}
                  className="rounded px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
          {/* Tabs */}
          {openTabs.length > 0 && (
            <div className="flex h-9 items-center border-b border-gray-200 bg-gray-50/50">
              {openTabs.map((tab) => (
                <div
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group flex h-full cursor-pointer items-center gap-2 border-r border-gray-200 px-3 text-xs transition-colors ${
                    activeTab === tab.id
                      ? "border-b-2 border-b-blue-500 bg-white text-gray-900"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {iconMap[tab.type] || (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                    <span className="font-medium">{tab.name}</span>
                    {dirtyTabs.has(tab.id) && (
                      <span className="h-2 w-2 rounded-full bg-gray-400" title="Unsaved changes" />
                    )}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className="ml-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-gray-200 group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Breadcrumb */}
          {activeTab && (
            <div className="flex h-7 items-center border-b border-gray-100 bg-white px-4 text-[11px] text-gray-400">
              <div className="flex-1 flex items-center">
              {activeTab
                .split("/")
                .filter(Boolean)
                .map((segment, i, arr) => (
                  <span key={i} className="flex items-center">
                    {i > 0 && <span className="mx-1">/</span>}
                    <span className={i === arr.length - 1 ? "text-gray-600" : ""}>
                      {segment}
                    </span>
                  </span>
                ))}
              </div>
              {dirtyTabs.has(activeTab) ? (
                <button
                  onClick={() => {
                    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                    saveFile(activeTab, fileContents[activeTab] ?? "");
                  }}
                  disabled={saving}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  title="Save (auto-saves after 1s)"
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  Save
                </button>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-green-500">
                  <Check className="h-3 w-3" />
                  Saved
                </span>
              )}
            </div>
          )}

          {/* Editor content */}
          <div className="flex-1 overflow-auto bg-white">
            {activeTab ? (
              (() => {
                const activeTabData = openTabs.find((t) => t.id === activeTab);
                const category = activeTabData
                  ? getFileCategory(activeTabData)
                  : "binary";

                if (category === "image") {
                  return (
                    <div className="flex h-full items-center justify-center bg-[#f5f5f5] p-8">
                      <div className="text-center">
                        <div className="mx-auto mb-4 flex h-32 w-32 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white">
                          <Image className="h-12 w-12 text-gray-300" />
                        </div>
                        <p className="text-sm font-medium text-gray-600">
                          {activeTabData?.name}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          Image preview not available in demo
                        </p>
                      </div>
                    </div>
                  );
                }

                if (category === "binary") {
                  return (
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center">
                        <FileText className="mx-auto mb-4 h-16 w-16 text-gray-200" />
                        <p className="text-sm font-medium text-gray-500">
                          The file is not displayed in the editor because it is
                          either binary or uses an unsupported text encoding.
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <Editor key={activeTab} content={activeContent} onChange={handleEditorChange} />
                );
              })()
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Code2 className="mx-auto mb-4 h-16 w-16 text-gray-200" />
                  <p className="text-lg font-medium text-gray-400">
                    No file open
                  </p>
                  <p className="mt-1 text-sm text-gray-300">
                    Select a file from the explorer to start editing
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex h-6 items-center justify-between border-t border-gray-200 bg-blue-600 px-3 text-[11px] text-white">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            main
          </span>
          <span>0 problems</span>
        </div>
        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          {activeTab && <span>{getFileLanguage(activeTab)}</span>}
          <span>Ln 1, Col 1</span>
          <Bell className="h-3 w-3" />
        </div>
      </div>
    </div>
  );
}
