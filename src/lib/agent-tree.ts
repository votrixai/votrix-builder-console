import type { ApiTreeEntry } from "@/api/agent";
import type { TreeViewItem } from "@/components/tree-view";

export function getFileType(name: string, fileClass: string): string {
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

export function buildNestedTree(entries: ApiTreeEntry[]): TreeViewItem[] {
  const dirMap = new Map<string, TreeViewItem>();

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

    const parentPath = entry.path.substring(0, entry.path.lastIndexOf("/")) || "/";
    const parent = dirMap.get(parentPath);
    if (parent) {
      parent.children!.push(node);
    } else {
      roots.push(node);
    }
  }

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
