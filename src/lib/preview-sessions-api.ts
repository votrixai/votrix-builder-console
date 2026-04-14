const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

/** Create a backend user with a display name; returns the UUID. */
export async function createUser(displayName: string): Promise<string> {
  const res = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: displayName }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return (JSON.parse(text) as { id: string }).id;
}

export interface SessionSummary {
  id: string;
  user_id: string;
  display_name: string;
  created_at: string;
}

/** Lists all sessions for a user. */
export async function listUserSessions(userId: string): Promise<SessionSummary[]> {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/sessions`);
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return JSON.parse(text) as SessionSummary[];
}

/** Create a new session for a user + agent. */
export async function createSession(
  userId: string,
  agentId: string
): Promise<SessionSummary> {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent_id: agentId, display_name: "New session" }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return JSON.parse(text) as SessionSummary;
}

/** Prefer most recently created session. */
export function pickDefaultSession(sessions: SessionSummary[]): SessionSummary | null {
  return sessions[0] ?? null;
}
