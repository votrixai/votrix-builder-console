const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

export interface SessionSummary {
  id: string;
  agent_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  event_count: number;
}

export interface SessionListResponse {
  sessions: SessionSummary[];
  total: number;
  page_offset: number;
  page_size: number;
}

/** Lists sessions for a blueprint agent; pass `userId` to restrict to one end user. */
export async function listAgentSessionsForUser(
  agentId: string,
  userId: string,
  pageSize = 50
): Promise<SessionListResponse> {
  const url = new URL(`${API_BASE}/agents/${encodeURIComponent(agentId)}/sessions`);
  url.searchParams.set("user_id", userId);
  url.searchParams.set("page_size", String(pageSize));
  const res = await fetch(url.toString());
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `HTTP ${res.status}`);
  }
  return JSON.parse(text) as SessionListResponse;
}

/** Server generates and returns the new session id. */
export async function createAgentSession(
  agentId: string,
  userId: string
): Promise<SessionSummary> {
  const res = await fetch(
    `${API_BASE}/agents/${encodeURIComponent(agentId)}/sessions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    }
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `HTTP ${res.status}`);
  }
  return JSON.parse(text) as SessionSummary;
}

/** Prefer newest open session; else newest overall (list is created_at desc). */
export function pickDefaultSession(
  sessions: SessionSummary[]
): SessionSummary | null {
  if (!sessions.length) return null;
  const open = sessions.filter((s) => !s.ended_at);
  const pool = open.length ? open : sessions;
  return pool[0] ?? null;
}
