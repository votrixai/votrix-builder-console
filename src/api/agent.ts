const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;
const AGENT_ID = process.env.NEXT_PUBLIC_AGENT_ID!;

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

export async function fetchTree(): Promise<ApiTreeEntry[]> {
  const res = await fetch(`${API_BASE}/agents/${AGENT_ID}/files/tree`);
  return res.json();
}

export async function fetchFileContent(path: string): Promise<string> {
  const res = await fetch(
    `${API_BASE}/agents/${AGENT_ID}/files/read?path=${encodeURIComponent(path)}`
  );
  const data: ApiFileContent = await res.json();
  return data.content ?? "";
}

export async function fetchAllContents(
  entries: ApiTreeEntry[]
): Promise<Record<string, string>> {
  const files = entries.filter((e) => e.type === "file");
  const results = await Promise.all(
    files.map(async (f) => {
      try {
        const content = await fetchFileContent(f.path);
        return [f.path, content] as const;
      } catch {
        return [f.path, ""] as const;
      }
    })
  );
  return Object.fromEntries(results);
}

export async function saveFile(path: string, content: string): Promise<void> {
  await fetch(`${API_BASE}/agents/${AGENT_ID}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content, mime_type: "text/markdown" }),
  });
}

export async function createDirectory(path: string): Promise<void> {
  await fetch(`${API_BASE}/agents/${AGENT_ID}/files/mkdir`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
}

export async function moveFile(oldPath: string, newPath: string): Promise<void> {
  await fetch(`${API_BASE}/agents/${AGENT_ID}/files/mv`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ old_path: oldPath, new_path: newPath }),
  });
}

export async function bulkMove(
  moves: { old_path: string; new_path: string }[]
): Promise<void> {
  await fetch(`${API_BASE}/agents/${AGENT_ID}/files/bulk-mv`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moves }),
  });
}

export async function copyFile(sourcePath: string, destPath: string): Promise<void> {
  await fetch(`${API_BASE}/agents/${AGENT_ID}/files/cp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_path: sourcePath, dest_path: destPath }),
  });
}

export async function bulkDelete(paths: string[]): Promise<void> {
  await fetch(`${API_BASE}/agents/${AGENT_ID}/files/bulk-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths, recursive: true }),
  });
}
