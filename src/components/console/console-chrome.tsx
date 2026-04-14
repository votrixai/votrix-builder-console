"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, ChevronDown, Eye, Loader2 } from "lucide-react";
import { useAgentId } from "@/contexts/agent-id-context";
import { useOrgId } from "@/contexts/org-id-context";
import { useEffect, useState } from "react";
import { getAgent, patchAgentMeta } from "@/api/platform";

const nav = [
  { href: "/preview", label: "Preview", icon: Eye },
] as const;

export function ConsoleChrome() {
  const pathname = usePathname();
  const { agentId, setAgentId } = useAgentId();
  const { orgId, setOrgId } = useOrgId();
  const [draftAgent, setDraftAgent] = useState(agentId);
  const [draftOrg, setDraftOrg] = useState(orgId);
  const [agentPanelOpen, setAgentPanelOpen] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentModel, setAgentModel] = useState("");
  const [agentMetaLoading, setAgentMetaLoading] = useState(false);
  const [agentMetaSaving, setAgentMetaSaving] = useState(false);
  const [agentMetaError, setAgentMetaError] = useState<string | null>(null);

  useEffect(() => {
    setDraftAgent(agentId);
  }, [agentId]);

  useEffect(() => {
    setDraftOrg(orgId);
  }, [orgId]);

  useEffect(() => {
    let mounted = true;
    const currentAgentId = agentId.trim();
    if (!currentAgentId) {
      setAgentName("");
      setAgentModel("");
      setAgentMetaError(null);
      return;
    }
    setAgentMetaLoading(true);
    setAgentMetaError(null);
    getAgent(currentAgentId)
      .then((agent) => {
        if (!mounted) return;
        setAgentName(agent.display_name ?? "");
        setAgentModel(agent.model ?? "");
      })
      .catch((err) => {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : "Failed to load agent settings";
        setAgentMetaError(msg);
      })
      .finally(() => {
        if (!mounted) return;
        setAgentMetaLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [agentId]);

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

  async function handleSaveAgentMeta() {
    const currentAgentId = agentId.trim();
    if (!currentAgentId) return;
    setAgentMetaSaving(true);
    setAgentMetaError(null);
    try {
      const updated = await patchAgentMeta(currentAgentId, {
        display_name: agentName,
        model: agentModel,
      });
      setAgentName(updated.display_name ?? "");
      setAgentModel(updated.model ?? "");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save agent settings";
      setAgentMetaError(msg);
    } finally {
      setAgentMetaSaving(false);
    }
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
        <div className="relative">
          <button
            type="button"
            onClick={() => setAgentPanelOpen((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 transition-colors hover:bg-gray-100"
            aria-expanded={agentPanelOpen}
            aria-label="Toggle agent settings"
            title="Edit agent name and model"
          >
            Settings
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                agentPanelOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {agentPanelOpen && (
            <div className="absolute right-0 top-8 z-50 w-80 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
              <div className="space-y-2">
                <div>
                  <label className="mb-1 block text-[11px] text-gray-500">Agent Name</label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                    placeholder="Customer Support Agent"
                    className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-gray-500">Model</label>
                  <input
                    type="text"
                    value={agentModel}
                    onChange={(e) => setAgentModel(e.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                    placeholder="gpt-4o-mini"
                    className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 font-mono text-[12px] text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                {agentMetaError && (
                  <p className="text-[11px] text-red-600">{agentMetaError}</p>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-gray-400">
                    {agentMetaLoading ? "Loading..." : "Saved to backend"}
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveAgentMeta}
                    disabled={agentMetaLoading || agentMetaSaving || !agentId.trim()}
                    className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {agentMetaSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
