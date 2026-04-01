"use client";

import { useState, useCallback, useRef } from "react";
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
} from "lucide-react";

// Sample file tree data
const fileTree: TreeViewItem[] = [
  {
    id: "src",
    name: "src",
    type: "folder",
    children: [
      {
        id: "components",
        name: "components",
        type: "folder",
        children: [
          { id: "button.tsx", name: "Button.tsx", type: "tsx" },
          { id: "input.tsx", name: "Input.tsx", type: "tsx" },
          { id: "modal.tsx", name: "Modal.tsx", type: "tsx" },
        ],
      },
      {
        id: "pages",
        name: "pages",
        type: "folder",
        children: [
          { id: "index.tsx", name: "index.tsx", type: "tsx" },
          { id: "about.tsx", name: "about.tsx", type: "tsx" },
        ],
      },
      {
        id: "styles",
        name: "styles",
        type: "folder",
        children: [
          { id: "globals.css", name: "globals.css", type: "css" },
          { id: "home.module.css", name: "home.module.css", type: "css" },
        ],
      },
      { id: "app.tsx", name: "App.tsx", type: "tsx" },
      { id: "utils.ts", name: "utils.ts", type: "ts" },
    ],
  },
  {
    id: "public",
    name: "public",
    type: "folder",
    children: [
      { id: "favicon.ico", name: "favicon.ico", type: "image" },
      { id: "logo.png", name: "logo.png", type: "image" },
    ],
  },
  { id: "package.json", name: "package.json", type: "json" },
  { id: "tsconfig.json", name: "tsconfig.json", type: "json" },
  { id: "readme.md", name: "README.md", type: "md" },
  { id: ".gitignore", name: ".gitignore", type: "file" },
];

// Sample file contents
const fileContents: Record<string, string> = {
  "button.tsx": `import React from "react";

interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  onClick,
}: ButtonProps) {
  return (
    <button
      className={\`btn btn-\${variant} btn-\${size}\`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}`,
  "input.tsx": `import React from "react";

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}

export function Input({ label, placeholder, value, onChange }: InputProps) {
  return (
    <div className="input-wrapper">
      {label && <label>{label}</label>}
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}`,
  "modal.tsx": `import React from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}`,
  "index.tsx": `import { Button } from "../components/Button";

export default function Home() {
  return (
    <main>
      <h1>Welcome to My App</h1>
      <p>This is the home page.</p>
      <Button variant="primary" onClick={() => alert("Hello!")}>
        Get Started
      </Button>
    </main>
  );
}`,
  "about.tsx": `export default function About() {
  return (
    <main>
      <h1>About Us</h1>
      <p>We build amazing software.</p>
    </main>
  );
}`,
  "globals.css": `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
}

a {
  color: inherit;
  text-decoration: none;
}`,
  "home.module.css": `.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.hero {
  text-align: center;
  padding: 4rem 0;
}

.hero h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
}`,
  "app.tsx": `import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/index";
import About from "./pages/about";
import "./styles/globals.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </BrowserRouter>
  );
}`,
  "utils.ts": `export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}`,
  "package.json": `{
  "name": "my-app",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}`,
  "tsconfig.json": `{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}`,
  "readme.md": `# My App

A simple React application built with Next.js.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Features

- Component library (Button, Input, Modal)
- Client-side routing
- CSS Modules support
- TypeScript
`,
  ".gitignore": `node_modules/
.next/
out/
.env
.env.local
*.log
.DS_Store`,
};

const iconMap: Record<string, React.ReactNode> = {
  folder: <Folder className="h-4 w-4 text-blue-500" />,
  tsx: <FileCode className="h-4 w-4 text-sky-500" />,
  ts: <FileCode className="h-4 w-4 text-blue-600" />,
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
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([
    { id: "app.tsx", name: "App.tsx", type: "tsx" },
  ]);
  const [activeTab, setActiveTab] = useState<string>("app.tsx");
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const isResizing = useRef(false);

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

  function getItemPath(item: TreeViewItem): string {
    function find(
      nodes: TreeViewItem[],
      targetId: string,
      path: string[]
    ): string[] | null {
      for (const node of nodes) {
        const current = [...path, node.name];
        if (node.id === targetId) return current;
        if (node.children) {
          const found = find(node.children, targetId, current);
          if (found) return found;
        }
      }
      return null;
    }
    return (find(fileTree, item.id, []) ?? [item.name]).join("/");
  }

  const contextMenuItems: TreeViewMenuItem[] = [
    {
      id: "new-file",
      label: "New File",
      icon: <FilePlus className="h-4 w-4" />,
      showFor: (item) => item.type === "folder",
      action: (items) => {
        const folder = items[0];
        const name = prompt("New file name:");
        if (!name) return;
        console.log(`Create file "${name}" in folder "${folder.name}"`);
      },
    },
    {
      id: "new-folder",
      label: "New Folder",
      icon: <FolderPlus className="h-4 w-4" />,
      showFor: (item) => item.type === "folder",
      action: (items) => {
        const folder = items[0];
        const name = prompt("New folder name:");
        if (!name) return;
        console.log(`Create folder "${name}" in folder "${folder.name}"`);
      },
    },
    {
      id: "cut",
      label: "Cut",
      icon: <Scissors className="h-4 w-4" />,
      separator: true,
      action: (items) => {
        console.log(`Cut "${items[0].name}"`);
      },
    },
    {
      id: "copy",
      label: "Copy",
      icon: <Copy className="h-4 w-4" />,
      action: (items) => {
        console.log(`Copy "${items[0].name}"`);
      },
    },
    {
      id: "copy-path",
      label: "Copy Path",
      icon: <ClipboardCopy className="h-4 w-4" />,
      separator: true,
      action: (items) => {
        const fullPath = `/project/${getItemPath(items[0])}`;
        navigator.clipboard.writeText(fullPath);
        console.log(`Copied path: ${fullPath}`);
      },
    },
    {
      id: "copy-relative-path",
      label: "Copy Relative Path",
      icon: <ClipboardCopy className="h-4 w-4" />,
      action: (items) => {
        const relPath = getItemPath(items[0]);
        navigator.clipboard.writeText(relPath);
        console.log(`Copied relative path: ${relPath}`);
      },
    },
    {
      id: "rename",
      label: "Rename",
      icon: <Pencil className="h-4 w-4" />,
      separator: true,
      action: (items) => {
        const item = items[0];
        const newName = prompt("Rename to:", item.name);
        if (!newName || newName === item.name) return;
        console.log(`Rename "${item.name}" to "${newName}"`);
      },
    },
    {
      id: "delete",
      label: "Delete",
      icon: <Trash2 className="h-4 w-4 text-red-500" />,
      action: (items) => {
        const item = items[0];
        if (confirm(`Delete "${item.name}"?`)) {
          console.log(`Delete "${item.name}"`);
        }
      },
    },
  ];

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white">
      {/* Title bar */}
      <div className="flex h-10 items-center justify-between border-b border-gray-200 bg-gray-50 px-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Code2 className="h-4 w-4 text-blue-500" />
          <span>Votrix Editor</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>my-app</span>
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
            <TreeView
              data={fileTree}
              iconMap={iconMap}
              showExpandAll
              className="tree-view-light"
              searchPlaceholder="Search files..."
              menuItems={contextMenuItems}
              onSelectionChange={handleSelectionChange}
              onDrop={(dragged, target) => {
                const dest = target.type === "folder" ? target.name : "root";
                console.log(`Moved "${dragged.name}" into "${dest}"`);
              }}
            />
          </div>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className="w-1 flex-shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-blue-400"
        />

        {/* Editor area */}
        <div className="flex flex-1 flex-col overflow-hidden">
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
              <span>src</span>
              <span className="mx-1">/</span>
              <span className="text-gray-600">{activeTab}</span>
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
                  <Editor key={activeTab} content={activeContent} />
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
