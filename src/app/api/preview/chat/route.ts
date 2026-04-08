import { NextRequest } from "next/server";
import type { UIMessage } from "ai";
import { extractLastUserText } from "@/lib/extract-last-user-text";
import { votrixSseToAiUiMessageStream } from "@/lib/votrix-chat-stream";

function getApiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE?.trim() || "http://localhost:8000";
  return base.replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const agentId = String(body.agent_id ?? "").trim();
  const userId = String(body.user_id ?? "").trim();
  const sessionId = String(body.session_id ?? "").trim();
  const messages = body.messages as UIMessage[] | undefined;
  const messageFromClient =
    typeof body.message === "string" ? body.message.trim() : "";
  const images = Array.isArray(body.images)
    ? (body.images as unknown[]).filter((u): u is string => typeof u === "string")
    : [];

  if (!agentId || !userId || !sessionId) {
    return new Response(
      JSON.stringify({
        error: "agent_id, user_id, and session_id are required",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const message = messageFromClient || extractLastUserText(messages);
  if (!message) {
    return new Response(
      JSON.stringify({ error: "At least one user message with text is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const apiBase = getApiBase();
  const url = `${apiBase}/agents/${encodeURIComponent(agentId)}/chat`;

  let backendRes: Response;
  try {
    backendRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        session_id: sessionId,
        message,
        images,
      }),
      signal: req.signal,
    });
  } catch (e) {
    const err = e as { name?: string; message?: string };
    if (err?.name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    return new Response(
      JSON.stringify({
        error: "Failed to reach Votrix backend",
        message: err?.message ?? String(e),
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!backendRes.ok) {
    const detail = await backendRes.text();
    return new Response(
      JSON.stringify({
        error: `Backend error: ${backendRes.status}`,
        detail: detail.slice(0, 800),
      }),
      {
        status: backendRes.status >= 500 ? 502 : backendRes.status,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const backendBody = backendRes.body;
  if (!backendBody) {
    return new Response(JSON.stringify({ error: "Empty response body from backend" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const out = votrixSseToAiUiMessageStream(backendBody);

  return new Response(out, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "x-vercel-ai-ui-message-stream": "v1",
    },
  });
}
