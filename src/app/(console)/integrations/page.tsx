"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAgentId } from "@/contexts/agent-id-context";
import { useOrgId } from "@/contexts/org-id-context";
import {
  getOrg,
  patchOrg,
  listIntegrationCatalog,
  getIntegrationDetail,
  getAgent,
  patchAgentIntegrations,
  type OrgDetail,
  type IntegrationSummary,
  type AgentDetail,
  type AgentIntegrationRow,
  type IntegrationDetail,
} from "@/api/platform";
import { Loader2, Plug, Plus, Save, AlertTriangle, X } from "lucide-react";

function agentRowsToMap(rows: AgentIntegrationRow[]): Map<string, AgentIntegrationRow> {
  const m = new Map<string, AgentIntegrationRow>();
  for (const r of rows) m.set(r.integration_slug, { ...r });
  return m;
}

function toolNamesFromDetail(d: IntegrationDetail | undefined): string[] {
  return d?.tools.map((t) => t.name) ?? [];
}

export default function IntegrationsPage() {
  const { agentId } = useAgentId();
  const { orgId } = useOrgId();

  const [orgDetail, setOrgDetail] = useState<OrgDetail | null>(null);
  const [catalog, setCatalog] = useState<IntegrationSummary[]>([]);
  const [agentDetail, setAgentDetail] = useState<AgentDetail | null>(null);
  const [draftAgentMap, setDraftAgentMap] = useState<
    Map<string, AgentIntegrationRow>
  >(new Map());
  const [toolCache, setToolCache] = useState<Record<string, IntegrationDetail>>({});
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const [loadingOrg, setLoadingOrg] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);
  const [savingAgent, setSavingAgent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerResults, setPickerResults] = useState<IntegrationSummary[]>([]);
  const [pickerOffset, setPickerOffset] = useState(0);
  const [pickerHasMore, setPickerHasMore] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerLoadingMore, setPickerLoadingMore] = useState(false);
  const [attachingSlug, setAttachingSlug] = useState<string | null>(null);
  const attachGenRef = useRef(0);
  const pickerReqRef = useRef(0);
  const pickerOffsetRef = useRef(0);
  const PICKER_PAGE_SIZE = 50;

  useEffect(() => {
    pickerOffsetRef.current = pickerOffset;
  }, [pickerOffset]);

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const list = await listIntegrationCatalog();
      setCatalog(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  const refreshOrg = useCallback(async () => {
    if (!orgId.trim()) {
      setOrgDetail(null);
      return;
    }
    setLoadingOrg(true);
    setError(null);
    try {
      const d = await getOrg(orgId.trim());
      setOrgDetail(d);
    } catch (e) {
      setOrgDetail(null);
      setError(e instanceof Error ? e.message : "Failed to load org");
    } finally {
      setLoadingOrg(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    refreshOrg();
  }, [refreshOrg]);

  useEffect(() => {
    setActiveSlug(null);
  }, [orgId]);

  useEffect(() => {
    if (!agentId.trim()) {
      setAgentDetail(null);
      setDraftAgentMap(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingAgent(true);
      try {
        const a = await getAgent(agentId.trim());
        if (cancelled) return;
        setAgentDetail(a);
        setDraftAgentMap(agentRowsToMap(a.integrations));
      } catch {
        if (!cancelled) {
          setAgentDetail(null);
          setDraftAgentMap(new Map());
        }
      } finally {
        if (!cancelled) setLoadingAgent(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const orgSlugs = orgDetail?.enabled_integration_slugs ?? [];
  const orgSlugsSorted = useMemo(() => [...orgSlugs].sort(), [orgSlugs]);

  const toolFetchKey =
    activeSlug && draftAgentMap.has(activeSlug) ? activeSlug : null;

  useEffect(() => {
    if (!toolFetchKey) return;
    const slug = toolFetchKey;
    if (toolCache[slug]) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await getIntegrationDetail(slug);
        if (cancelled) return;
        setToolCache((c) => (c[slug] ? c : { ...c, [slug]: d }));
      } catch (e) {
        console.error(e);
        if (cancelled) return;
        setToolCache((c) =>
          c[slug]
            ? c
            : {
                ...c,
                [slug]: {
                  slug,
                  display_name: slug,
                  description: "",
                  provider_type: "unspecified",
                  deferred: false,
                  tools: [],
                },
              }
        );
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally omit toolCache: re-run only when the active slug changes; read cache from closure.
  }, [toolFetchKey]);

  const catalogBySlug = useMemo(() => {
    const m = new Map<string, IntegrationSummary>();
    for (const c of catalog) m.set(c.slug, c);
    return m;
  }, [catalog]);

  const orgSlugSet = useMemo(() => new Set(orgSlugs), [orgSlugs]);

  const [attachedOrgSlugs, unattachedOrgSlugs] = useMemo(() => {
    const attached: string[] = [];
    const unattached: string[] = [];
    for (const slug of orgSlugsSorted) {
      const onAgent = draftAgentMap.has(slug) || attachingSlug === slug;
      if (onAgent) attached.push(slug);
      else unattached.push(slug);
    }
    return [attached, unattached] as const;
  }, [orgSlugsSorted, draftAgentMap, attachingSlug]);

  useEffect(() => {
    if (activeSlug || orgSlugsSorted.length === 0) return;
    setActiveSlug(orgSlugsSorted[0]);
  }, [activeSlug, orgSlugsSorted]);

  const orgMismatch = Boolean(
    agentDetail && orgId.trim() && agentDetail.org_id !== orgId.trim()
  );

  const pickerItems = useMemo(
    () => pickerResults.filter((c) => !orgSlugSet.has(c.slug)),
    [pickerResults, orgSlugSet]
  );

  const loadPickerPage = useCallback(
    async (opts: { reset: boolean }) => {
      const reqId = ++pickerReqRef.current;
      const search = pickerSearch.trim();
      const offset = opts.reset ? 0 : pickerOffsetRef.current;
      if (opts.reset) setPickerLoading(true);
      else setPickerLoadingMore(true);
      try {
        const page = await listIntegrationCatalog(search, PICKER_PAGE_SIZE, offset);
        if (reqId !== pickerReqRef.current) return;
        setPickerResults((prev) => (opts.reset ? page : [...prev, ...page]));
        setPickerOffset(offset + page.length);
        setPickerHasMore(page.length === PICKER_PAGE_SIZE);
      } catch (e) {
        if (reqId !== pickerReqRef.current) return;
        setError(
          e instanceof Error ? e.message : "Failed to load integration catalog"
        );
      } finally {
        if (reqId !== pickerReqRef.current) return;
        setPickerLoading(false);
        setPickerLoadingMore(false);
      }
    },
    [pickerSearch]
  );

  useEffect(() => {
    if (!addOpen) return;
    const timer = setTimeout(() => {
      void loadPickerPage({ reset: true });
    }, 250);
    return () => clearTimeout(timer);
  }, [addOpen, pickerSearch, loadPickerPage]);

  async function addSlugToOrg(slug: string) {
    if (!orgId.trim() || orgSlugSet.has(slug)) return;
    setSavingOrg(true);
    setError(null);
    try {
      const next = [...orgSlugs, slug];
      const updated = await patchOrg(orgId.trim(), {
        enabled_integration_slugs: next,
      });
      setOrgDetail(updated);
      void loadPickerPage({ reset: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add integration");
    } finally {
      setSavingOrg(false);
    }
  }

  async function removeSlugFromOrg(slug: string) {
    if (!orgId.trim()) return;
    setSavingOrg(true);
    setError(null);
    try {
      const next = orgSlugs.filter((s) => s !== slug);
      const updated = await patchOrg(orgId.trim(), {
        enabled_integration_slugs: next,
      });
      setOrgDetail(updated);
      setDraftAgentMap((prev) => {
        const m = new Map(prev);
        m.delete(slug);
        return m;
      });
      setActiveSlug((prev) => (prev === slug ? null : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove integration");
    } finally {
      setSavingOrg(false);
    }
  }

  async function handleSaveAgentIntegrations() {
    if (!agentId.trim()) return;
    const rows: AgentIntegrationRow[] = [];
    for (const slug of orgSlugSet) {
      const row = draftAgentMap.get(slug);
      if (row) rows.push(row);
    }
    setSavingAgent(true);
    setError(null);
    try {
      const updated = await patchAgentIntegrations(agentId.trim(), rows);
      setAgentDetail(updated);
      setDraftAgentMap(agentRowsToMap(updated.integrations));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save agent failed");
    } finally {
      setSavingAgent(false);
    }
  }

  async function attachAgentIntegration(
    slug: string,
    meta: IntegrationSummary | undefined
  ) {
    if (orgMismatch) return;
    const gen = ++attachGenRef.current;
    setAttachingSlug(slug);
    setActiveSlug(slug);
    setError(null);
    setDraftAgentMap((prev) => {
      if (prev.has(slug)) return prev;
      const next = new Map(prev);
      next.set(slug, {
        integration_slug: slug,
        deferred: meta?.deferred ?? false,
        enabled_tool_slugs: [],
      });
      return next;
    });
    try {
      const d = await getIntegrationDetail(slug);
      if (gen !== attachGenRef.current) return;
      setToolCache((c) => ({ ...c, [slug]: d }));
      const names = d.tools.map((t) => t.name).sort();
      setDraftAgentMap((prev) => {
        const next = new Map(prev);
        next.set(slug, {
          integration_slug: slug,
          deferred: d.deferred,
          enabled_tool_slugs: names,
        });
        return next;
      });
      setActiveSlug(slug);
    } catch (e) {
      if (gen !== attachGenRef.current) return;
      console.error(e);
      setDraftAgentMap((prev) => {
        const next = new Map(prev);
        next.set(slug, {
          integration_slug: slug,
          deferred: meta?.deferred ?? false,
          enabled_tool_slugs: [],
        });
        return next;
      });
      setActiveSlug(slug);
    } finally {
      if (gen === attachGenRef.current) setAttachingSlug(null);
    }
  }

  function detachAgentIntegration(slug: string) {
    setAttachingSlug((cur) => {
      if (cur === slug) {
        attachGenRef.current += 1;
        return null;
      }
      return cur;
    });
    setDraftAgentMap((prev) => {
      const next = new Map(prev);
      next.delete(slug);
      return next;
    });
    setActiveSlug((prev) => (prev === slug ? null : prev));
  }

  function setAgentDeferred(slug: string, deferred: boolean) {
    setDraftAgentMap((prev) => {
      const row = prev.get(slug);
      if (!row) return prev;
      const next = new Map(prev);
      next.set(slug, { ...row, deferred });
      return next;
    });
  }

  function toggleTool(slug: string, toolName: string, on: boolean) {
    setDraftAgentMap((prev) => {
      const next = new Map(prev);
      const row = next.get(slug);
      if (!row) return prev;
      const s = new Set(row.enabled_tool_slugs);
      if (on) s.add(toolName);
      else s.delete(toolName);
      next.set(slug, {
        ...row,
        enabled_tool_slugs: [...s].sort(),
      });
      return next;
    });
  }

  function renderAgentIntegrationRow(slug: string) {
    const meta = catalogBySlug.get(slug);
    const deferredCatalogHint =
      toolCache[slug]?.deferred ?? meta?.deferred ?? false;
    const attached = draftAgentMap.has(slug) || attachingSlug === slug;
    const selected = activeSlug === slug;
    return (
      <li key={slug}>
        <div
          className={`flex cursor-pointer items-start gap-2 rounded-md border px-2 py-2 text-left transition-colors ${
            selected
              ? "border-blue-300 bg-blue-50/80"
              : "border-transparent hover:bg-gray-50"
          }`}
          onClick={() => setActiveSlug(slug)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActiveSlug(slug);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <input
            type="checkbox"
            checked={attached}
            disabled={
              !!orgMismatch ||
              (attachingSlug !== null && attachingSlug !== slug)
            }
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              if (e.target.checked) {
                void attachAgentIntegration(slug, meta);
              } else {
                detachAgentIntegration(slug);
              }
            }}
            className="mt-0.5"
          />
          {attachingSlug === slug ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-800">
              {meta?.display_name ?? slug}
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-mono text-[11px] text-gray-400">
                {slug}
              </span>
              {attached ? (
                <label
                  className="flex shrink-0 cursor-pointer items-center gap-1 text-[10px] text-gray-600"
                  title={`Catalog default: ${deferredCatalogHint ? "on" : "off"}. When on, tools stay in the deferred bucket until activated.`}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={draftAgentMap.get(slug)?.deferred ?? false}
                    disabled={!!orgMismatch || attachingSlug === slug}
                    onChange={(e) =>
                      setAgentDeferred(slug, e.target.checked)
                    }
                    className="rounded border-gray-300"
                  />
                  <span>Deferred</span>
                </label>
              ) : null}
            </div>
          </div>
        </div>
      </li>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="border-b border-gray-200 bg-gray-50/80 px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Plug className="h-4 w-4 text-blue-500" />
          Integrations
        </div>
        <p className="mt-0.5 text-[11px] text-gray-500">
          Set <strong>Org</strong> in the header and add integrations with <strong>+</strong>.
          Attaching an integration to the agent selects <strong>all tools</strong> by default;
          adjust on the right. <strong>Deferred</strong> follows the integration catalog default
          and can be overridden per row.
        </p>
      </div>

      {error && (
        <div className="mx-4 mt-2 flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4">
        <section className="mb-6 shrink-0 md:mb-8">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Org integrations
            </h2>
            <button
              type="button"
              disabled={!orgId.trim() || savingOrg || loadingOrg}
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          {!orgId.trim() ? (
            <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-3 py-6 text-center text-xs text-gray-500">
              Enter an <strong>Org</strong> ID in the top bar.
            </p>
          ) : loadingOrg ? (
            <div className="flex justify-center py-8 text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : orgSlugs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-3 py-6 text-center text-xs text-gray-500">
              No integrations on this org yet. Click <strong>+ Add</strong> to pick
              from the catalog.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {orgSlugsSorted.map((slug) => {
                const meta = catalogBySlug.get(slug);
                return (
                  <li
                    key={slug}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-gray-200 bg-white py-1 pl-3 pr-1 text-xs text-gray-800 shadow-sm"
                  >
                    <span className="truncate font-medium">
                      {meta?.display_name ?? slug}
                    </span>
                    <span className="font-mono text-[10px] text-gray-400">
                      {slug}
                    </span>
                    <button
                      type="button"
                      disabled={savingOrg}
                      onClick={() => removeSlugFromOrg(slug)}
                      className="rounded-full p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="Remove from org"
                      aria-label={`Remove ${slug} from org`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Agent integrations
            </h2>
            <button
              type="button"
              disabled={
                !agentId.trim() ||
                savingAgent ||
                loadingAgent ||
                !agentDetail ||
                orgMismatch ||
                !orgId.trim() ||
                attachingSlug !== null
              }
              onClick={handleSaveAgentIntegrations}
              className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {savingAgent ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save agent
            </button>
          </div>
          {orgMismatch && (
            <div className="mb-3 shrink-0 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              This agent belongs to a different org. Change <strong>Org</strong> or{" "}
              <strong>Agent</strong> in the header.
            </div>
          )}
          {!agentId.trim() ? (
            <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-3 py-6 text-center text-xs text-gray-500">
              Enter an <strong>Agent</strong> ID in the top bar.
            </p>
          ) : loadingAgent ? (
            <div className="flex justify-center py-8 text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !agentDetail ? (
            <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-3 py-6 text-center text-xs text-gray-500">
              Could not load agent.
            </p>
          ) : orgSlugsSorted.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-3 py-6 text-center text-xs text-gray-500">
              Add integrations to the org above first.
            </p>
          ) : (
            <div className="grid min-h-0 flex-1 gap-0 overflow-hidden rounded-lg border border-gray-200 md:grid-cols-2 md:divide-x md:divide-gray-200">
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-white p-3">
                <div className="mb-2 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Integrations on agent
                </div>
                <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain">
                  {attachedOrgSlugs.map(renderAgentIntegrationRow)}
                  {attachedOrgSlugs.length > 0 &&
                  unattachedOrgSlugs.length > 0 ? (
                    <li
                      key="_agent-integration-separator"
                      role="presentation"
                      className="list-none py-2"
                    >
                      <div
                        className="border-t border-gray-200"
                        aria-hidden
                      />
                    </li>
                  ) : null}
                  {unattachedOrgSlugs.map(renderAgentIntegrationRow)}
                </ul>
              </div>
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-gray-50/40 p-3">
                <div className="mb-2 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Tools
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {!activeSlug ? (
                  <p className="py-8 text-center text-xs text-gray-500">
                    Select an integration on the left.
                  </p>
                ) : !draftAgentMap.has(activeSlug) ? (
                  <p className="py-8 text-center text-xs text-gray-500">
                    Check the integration on the left to attach it, then configure
                    tools here.
                  </p>
                ) : (
                  (() => {
                    const slug = activeSlug;
                    const row = draftAgentMap.get(slug)!;
                    const attachingThis = attachingSlug === slug;
                    const detail = toolCache[slug];
                    const tools = detail?.tools ?? [];
                    const allNames = toolNamesFromDetail(detail);
                    const meta = catalogBySlug.get(slug);
                    const summary =
                      allNames.length === 0
                        ? "Loading or no tools…"
                        : `${row.enabled_tool_slugs.length} of ${allNames.length} tools selected`;

                    return (
                      <div className="flex min-h-0 flex-col">
                        <div className="mb-2 shrink-0 text-sm font-medium text-gray-800">
                          {meta?.display_name ?? slug}
                        </div>
                        <p className="mb-2 shrink-0 text-[11px] text-gray-500">{summary}</p>
                        <ul className="space-y-1.5 pr-1">
                          {tools.length === 0 ? (
                            <li className="flex items-center gap-2 py-4 text-xs text-gray-400">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading tools…
                            </li>
                          ) : (
                            tools.map((t) => (
                              <li
                                key={t.name}
                                className="flex items-start gap-2 rounded border border-gray-100 bg-white px-2 py-1.5 text-xs"
                              >
                                <input
                                  type="checkbox"
                                  disabled={!!orgMismatch || attachingThis}
                                  checked={row.enabled_tool_slugs.includes(t.name)}
                                  onChange={(e) =>
                                    toggleTool(
                                      slug,
                                      t.name,
                                      e.target.checked
                                    )
                                  }
                                  className="mt-0.5"
                                />
                                <div className="min-w-0">
                                  <div className="font-medium text-gray-800">
                                    {t.name}
                                  </div>
                                  {t.description && (
                                    <p className="mt-0.5 line-clamp-2 text-[11px] text-gray-500">
                                      {t.description}
                                    </p>
                                  )}
                                </div>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    );
                  })()
                )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-integration-title"
          onClick={() => {
            setAddOpen(false);
            setPickerSearch("");
            setPickerResults([]);
            setPickerOffset(0);
            setPickerHasMore(false);
          }}
        >
          <div
            className="flex max-h-[min(32rem,85vh)] w-full max-w-lg flex-col rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 id="add-integration-title" className="text-sm font-semibold">
                Add integration to org
              </h3>
              <button
                type="button"
                onClick={() => {
                  setAddOpen(false);
                  setPickerSearch("");
                  setPickerResults([]);
                  setPickerOffset(0);
                  setPickerHasMore(false);
                }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="border-b border-gray-100 p-3">
              <input
                autoFocus
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search catalog…"
                className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {pickerLoading || loadingCatalog ? (
                <div className="flex justify-center py-12 text-gray-400">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : pickerItems.length === 0 ? (
                <p className="py-8 text-center text-xs text-gray-500">
                  No matches or all are already on this org.
                </p>
              ) : (
                <ul className="space-y-1">
                  {pickerItems.map((c) => (
                    <li key={c.slug}>
                      <button
                        type="button"
                        disabled={savingOrg}
                        onClick={() => addSlugToOrg(c.slug)}
                        className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left text-sm hover:bg-blue-50 disabled:opacity-50"
                      >
                        <span className="font-medium text-gray-900">
                          {c.display_name}
                        </span>
                        <span className="font-mono text-xs text-gray-400">
                          {c.slug}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!pickerLoading && pickerItems.length > 0 && pickerHasMore && (
                <div className="pt-3 text-center">
                  <button
                    type="button"
                    disabled={savingOrg || pickerLoadingMore}
                    onClick={() => void loadPickerPage({ reset: false })}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {pickerLoadingMore ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load more"
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
