import type { UIMessage } from "ai";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

// Matches backend SessionEventResponse schema
export interface SessionEventRow {
  event_index: number;
  type: string;
  title: string | null;
  body: string;
}

export interface SessionDetailResponse {
  id: string;
  user_id: string;
  created_at: string;
  events: SessionEventRow[];
}

function textUserMessage(id: string, text: string): UIMessage {
  return {
    id,
    role: "user",
    parts: [{ type: "text", text, state: "done" }],
  };
}

function textAssistantMessage(id: string, text: string): UIMessage {
  return {
    id,
    role: "assistant",
    parts: [{ type: "text", text, state: "done" }],
  };
}

/** Map persisted session events to UI messages. */
export function sessionEventsToUiMessages(events: SessionEventRow[]): UIMessage[] {
  const ordered = [...events].sort((a, b) => a.event_index - b.event_index);
  const out: UIMessage[] = [];

  for (const ev of ordered) {
    const id = `evt-${ev.event_index}`;
    switch (ev.type) {
      case "user_message":
        out.push(textUserMessage(id, ev.body || ""));
        break;
      case "ai_message":
        out.push(textAssistantMessage(id, ev.body || ""));
        break;
      case "error":
        out.push(textAssistantMessage(id, `Error: ${ev.body || "unknown"}`));
        break;
      default:
        break;
    }
  }
  return out;
}

export async function fetchSessionUiMessages(sessionId: string): Promise<UIMessage[]> {
  const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}`);
  if (!res.ok) return [];
  const data = (await res.json()) as SessionDetailResponse;
  return sessionEventsToUiMessages(data.events ?? []);
}
