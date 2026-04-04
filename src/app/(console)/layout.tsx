"use client";

import { AgentIdProvider } from "@/contexts/agent-id-context";
import { OrgIdProvider } from "@/contexts/org-id-context";
import { EditorFilesProvider } from "@/contexts/editor-files-context";
import { ConsoleChrome } from "@/components/console/console-chrome";

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AgentIdProvider>
      <OrgIdProvider>
        <EditorFilesProvider>
          <div className="flex h-screen w-screen flex-col overflow-hidden bg-white">
            <ConsoleChrome />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {children}
            </div>
          </div>
        </EditorFilesProvider>
      </OrgIdProvider>
    </AgentIdProvider>
  );
}
