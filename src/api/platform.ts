const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const j = JSON.parse(text) as { detail?: string };
      if (typeof j.detail === "string") detail = j.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail || res.statusText);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

// ── Orgs ─────────────────────────────────────────────────────

export interface OrgSummary {
  id: string;
  display_name: string;
  created_at: string;
}

export interface OrgDetail {
  id: string;
  display_name: string;
  timezone: string;
  metadata: Record<string, unknown>;
  enabled_integration_slugs: string[];
  created_at: string;
  updated_at: string;
}

export async function listOrgs(): Promise<OrgSummary[]> {
  const res = await fetch(`${API_BASE}/orgs`);
  return parseJson<OrgSummary[]>(res);
}

export async function createOrg(body: {
  display_name: string;
  timezone?: string;
}): Promise<OrgDetail> {
  const res = await fetch(`${API_BASE}/orgs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      display_name: body.display_name,
      timezone: body.timezone ?? "UTC",
      metadata: {},
    }),
  });
  return parseJson<OrgDetail>(res);
}

export async function getOrg(orgId: string): Promise<OrgDetail> {
  const res = await fetch(`${API_BASE}/orgs/${orgId}`);
  return parseJson<OrgDetail>(res);
}

export async function patchOrg(
  orgId: string,
  body: { enabled_integration_slugs: string[] }
): Promise<OrgDetail> {
  const res = await fetch(`${API_BASE}/orgs/${orgId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<OrgDetail>(res);
}

// ── Integration catalog ─────────────────────────────────────

export type ProviderType =
  | "unspecified"
  | "composio"
  | "custom"
  | "platform";

export interface IntegrationSummary {
  slug: string;
  display_name: string;
  description: string;
  provider_type: ProviderType;
  deferred: boolean;
  tool_count: number;
}

export interface PropertyDef {
  type: string;
  description: string;
  required: boolean;
  default?: unknown;
  enum?: unknown[];
  items_type?: string | null;
}

export interface ToolSchemaResponse {
  name: string;
  description: string;
  input_schema: { properties: Record<string, PropertyDef> } | null;
}

export interface IntegrationDetail {
  slug: string;
  display_name: string;
  description: string;
  provider_type: ProviderType;
  deferred: boolean;
  tools: ToolSchemaResponse[];
}

export async function listIntegrationCatalog(
  search?: string
): Promise<IntegrationSummary[]> {
  const q = search?.trim()
    ? `?search=${encodeURIComponent(search.trim())}&limit=200`
    : "?limit=200";
  const res = await fetch(`${API_BASE}/integrations${q}`);
  return parseJson<IntegrationSummary[]>(res);
}

export async function getIntegrationDetail(
  slug: string
): Promise<IntegrationDetail> {
  const res = await fetch(
    `${API_BASE}/integrations/${encodeURIComponent(slug)}`
  );
  return parseJson<IntegrationDetail>(res);
}

// ── Agents ───────────────────────────────────────────────────

export interface AgentIntegrationRow {
  integration_slug: string;
  deferred: boolean;
  enabled_tool_slugs: string[];
}

export interface AgentDetail {
  id: string;
  org_id: string;
  display_name: string;
  model: string;
  integrations: AgentIntegrationRow[];
  created_at: string | null;
  updated_at: string | null;
}

export async function getAgent(agentId: string): Promise<AgentDetail> {
  const res = await fetch(`${API_BASE}/agents/${agentId}`);
  return parseJson<AgentDetail>(res);
}

export async function patchAgentIntegrations(
  agentId: string,
  integrations: AgentIntegrationRow[]
): Promise<AgentDetail> {
  const res = await fetch(`${API_BASE}/agents/${agentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ integrations }),
  });
  return parseJson<AgentDetail>(res);
}
