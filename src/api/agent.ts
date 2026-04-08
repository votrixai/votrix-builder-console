const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

const PROTECTED_ROOT_FOLDERS = new Set(["system-prompts", "skills", "user-files-default"]);

function isProtectedPath(path: string): boolean {
  const segments = path.replace(/\/+$/, "").split("/").filter(Boolean);
  return segments.length === 1 && PROTECTED_ROOT_FOLDERS.has(segments[0]);
}

function isRootLevel(path: string): boolean {
  const segments = path.replace(/\/+$/, "").split("/").filter(Boolean);
  return segments.length <= 1;
}

export interface ApiTreeEntry {
  path: string;
  name: string;
  type: "file" | "directory";
  file_class: string;
}

export interface ApiFileContent {
  path: string;
  name: string;
  content: string | null;
}

export async function fetchTree(agentId: string): Promise<ApiTreeEntry[]> {
  const res = await fetch(`${API_BASE}/agents/${agentId}/files/tree`);
  return res.json();
}

export async function fetchFileContent(
  agentId: string,
  path: string
): Promise<string> {
  const res = await fetch(
    `${API_BASE}/agents/${agentId}/files/read?path=${encodeURIComponent(path)}`
  );
  const data: ApiFileContent = await res.json();
  return data.content ?? "";
}

export async function fetchAllContents(
  agentId: string,
  entries: ApiTreeEntry[]
): Promise<Record<string, string>> {
  const files = entries.filter((e) => e.type === "file");
  const results = await Promise.all(
    files.map(async (f) => {
      try {
        const content = await fetchFileContent(agentId, f.path);
        return [f.path, content] as const;
      } catch {
        return [f.path, ""] as const;
      }
    })
  );
  return Object.fromEntries(results);
}

export async function saveFile(
  agentId: string,
  path: string,
  content: string
): Promise<void> {
  if (isRootLevel(path)) {
    throw new Error("Cannot create files at the root level.");
  }
  await fetch(`${API_BASE}/agents/${agentId}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content, mime_type: "text/markdown" }),
  });
}

export async function createDirectory(
  agentId: string,
  path: string
): Promise<void> {
  if (isRootLevel(path)) {
    throw new Error("Cannot create directories at the root level.");
  }
  await fetch(`${API_BASE}/agents/${agentId}/files/mkdir`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
}

export async function moveFile(
  agentId: string,
  oldPath: string,
  newPath: string
): Promise<void> {
  if (isProtectedPath(oldPath)) {
    throw new Error("Cannot rename or move a protected folder.");
  }
  await fetch(`${API_BASE}/agents/${agentId}/files/mv`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ old_path: oldPath, new_path: newPath }),
  });
}

export async function bulkMove(
  agentId: string,
  moves: { old_path: string; new_path: string }[]
): Promise<void> {
  const blocked = moves.filter((m) => isProtectedPath(m.old_path));
  if (blocked.length > 0) {
    throw new Error("Cannot rename or move a protected folder.");
  }
  await fetch(`${API_BASE}/agents/${agentId}/files/bulk-mv`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moves }),
  });
}

export async function copyFile(
  agentId: string,
  sourcePath: string,
  destPath: string
): Promise<void> {
  await fetch(`${API_BASE}/agents/${agentId}/files/cp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_path: sourcePath, dest_path: destPath }),
  });
}

export async function bulkDelete(agentId: string, paths: string[]): Promise<void> {
  const blocked = paths.filter(isProtectedPath);
  if (blocked.length > 0) {
    throw new Error("Cannot delete a protected folder.");
  }
  const res = await fetch(`${API_BASE}/agents/${agentId}/files/bulk-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths, recursive: true }),
  });
  if (!res.ok) {
    const message = await res.text().catch(() => "");
    throw new Error(message || `Delete failed with status ${res.status}`);
  }
}
