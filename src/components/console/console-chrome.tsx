"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Code2, Eye, Plug } from "lucide-react";
import { useAgentId } from "@/contexts/agent-id-context";
import { useOrgId } from "@/contexts/org-id-context";
import { useEffect, useState } from "react";

const nav = [
  { href: "/editor", label: "Editor", icon: Code2 },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/preview", label: "Preview", icon: Eye },
] as const;

export function ConsoleChrome() {
  const pathname = usePathname();
  const { agentId, setAgentId } = useAgentId();
  const { orgId, setOrgId } = useOrgId();
  const [draftAgent, setDraftAgent] = useState(agentId);
  const [draftOrg, setDraftOrg] = useState(orgId);

  useEffect(() => {
    setDraftAgent(agentId);
  }, [agentId]);

  useEffect(() => {
    setDraftOrg(orgId);
  }, [orgId]);

  function commitAgentId() {
    const t = draftAgent.trim();
    if (t) setAgentId(t);
    else setDraftAgent(agentId);
  }

  function commitOrgId() {
    const t = draftOrg.trim();
    if (t) setOrgId(t);
    else setDraftOrg(orgId);
  }

  return (
    <header className="flex h-10 shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-gray-50 px-4">
      <div className="flex min-w-0 items-center gap-6">
        <div className="flex shrink-0 items-center gap-2 text-sm font-semibold text-gray-800">
          <Boxes className="h-4 w-4 text-blue-500" />
          <span>Votrix Builder</span>
        </div>
        <nav className="flex items-center gap-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || pathname?.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex min-w-0 shrink-0 items-center gap-3 text-xs text-gray-500">
        <div className="flex min-w-0 max-w-[min(14rem,32vw)] items-center gap-1.5">
          <span className="shrink-0 text-gray-400">Org</span>
          <input
            type="text"
            value={draftOrg}
            onChange={(e) => setDraftOrg(e.target.value)}
            onBlur={commitOrgId}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            spellCheck={false}
            autoComplete="off"
            placeholder="org_…"
            className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 font-mono text-[11px] text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            title="Organization ID — saved in this browser"
            aria-label="Organization ID"
          />
        </div>
        <span className="text-gray-300" aria-hidden>
          |
        </span>
        <div className="flex min-w-0 max-w-[min(14rem,32vw)] items-center gap-1.5">
          <span className="shrink-0 text-gray-400">Agent</span>
          <input
            type="text"
            value={draftAgent}
            onChange={(e) => setDraftAgent(e.target.value)}
            onBlur={commitAgentId}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            spellCheck={false}
            autoComplete="off"
            placeholder="agent_…"
            className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 font-mono text-[11px] text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            title="Agent ID — saved in this browser"
            aria-label="Agent ID"
          />
        </div>
      </div>
    </header>
  );
}
