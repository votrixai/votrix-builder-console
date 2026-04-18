const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;
const PREVIEW_KEY = "preview-dev-votrix-2025";

function previewHeaders(userId: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-preview-key": PREVIEW_KEY,
    "x-preview-user-id": userId,
  };
}

export interface SessionSummary {
  id: string;
  user_id: string;
  agent_slug?: string | null;
  provider_session_title?: string | null;
  created_at: string;
}

/** Lists sessions for the given user, filtered to a specific agent. */
export async function listUserSessions(
  userId: string,
  agentId: string
): Promise<SessionSummary[]> {
  const url = new URL(`${API_BASE}/sessions`);
  url.searchParams.set("agent_slug", agentId);
  const res = await fetch(url.toString(), { headers: previewHeaders(userId) });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return JSON.parse(text) as SessionSummary[];
}

/** Create a new session for the given user + agent. */
export async function createSession(
  userId: string,
  agentId: string
): Promise<SessionSummary> {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: "POST",
    headers: previewHeaders(userId),
    body: JSON.stringify({ agent_slug: agentId }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return JSON.parse(text) as SessionSummary;
}

/** Prefer most recently created session. */
export function pickDefaultSession(sessions: SessionSummary[]): SessionSummary | null {
  return sessions[0] ?? null;
}
