import type { UIMessage } from "ai";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

export type SessionEventType =
  | "user_message"
  | "ai_message"
  | "tool_start"
  | "tool_end"
  | "error"
  | "snapshot";

export interface SessionEventRow {
  event_id: string;
  sequence_no: number;
  event_type: SessionEventType;
  event_title?: string | null;
  event_body: string;
}

export interface SessionDetailResponse {
  id: string;
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

/** Map persisted session events to UI messages (user / assistant text and errors only). */
export function sessionEventsToUiMessages(events: SessionEventRow[]): UIMessage[] {
  const ordered = [...events].sort((a, b) => a.sequence_no - b.sequence_no);
  const out: UIMessage[] = [];

  for (const ev of ordered) {
    switch (ev.event_type) {
      case "user_message":
        out.push(textUserMessage(ev.event_id, ev.event_body || ""));
        break;
      case "ai_message":
        out.push(textAssistantMessage(ev.event_id, ev.event_body || ""));
        break;
      case "error":
        out.push(
          textAssistantMessage(ev.event_id, `Error: ${ev.event_body || "unknown"}`)
        );
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
  const events = data.events ?? [];
  return sessionEventsToUiMessages(events);
}
