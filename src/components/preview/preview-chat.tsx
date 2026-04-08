"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isTextUIPart,
  isToolUIPart,
  type UIMessage,
} from "ai";
import { extractLastUserText } from "@/lib/extract-last-user-text";
import { ChevronRight, ImagePlus, Loader2, PlusCircle, SendHorizontal, Wrench, X } from "lucide-react";
import { useAgentId } from "@/contexts/agent-id-context";
import {
  loadStoredUserIdInput,
  saveStoredUserIdInput,
} from "@/lib/preview-chat-identity";
import {
  createAgentSession,
  listAgentSessionsForUser,
  pickDefaultSession,
  type SessionSummary,
} from "@/lib/preview-sessions-api";
import { fetchSessionUiMessages } from "@/lib/session-to-ui-messages";

/** Shared look for toolbar inputs / selects. */
const previewToolbarControl =
  "rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs text-slate-800 outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-200";

// ---------------------------------------------------------------------------
// Trace panel — shows tool calls from the current conversation
// ---------------------------------------------------------------------------

type AnyPart = UIMessage["parts"][number];

function toolPartName(part: AnyPart): string {
  if (!isToolUIPart(part)) return "tool";
  return part.type === "dynamic-tool"
    ? (part as { toolName: string }).toolName
    : String(part.type).replace(/^tool-/, "");
}

function toolPartCallId(part: AnyPart): string | undefined {
  const id = (part as { toolCallId?: string }).toolCallId;
  return typeof id === "string" && id ? id : undefined;
}

function ToolCallRow({ part }: { part: AnyPart }) {
  const [open, setOpen] = useState(false);

  if (!isToolUIPart(part)) return null;

  const name = toolPartName(part);

  const hasOutput =
    (part as { state?: string }).state === "output-available" &&
    (part as { output?: unknown }).output != null;

  const input = (part as { input?: unknown }).input;
  const output = (part as { output?: unknown }).output;

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
      >
        <ChevronRight
          className={`h-3 w-3 shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        />
        <span className="flex-1 truncate font-mono text-xs font-medium text-slate-700">
          {name}
        </span>
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
            hasOutput
              ? "bg-green-50 text-green-700"
              : "bg-amber-50 text-amber-600"
          }`}
        >
          {hasOutput ? "done" : "running"}
        </span>
      </button>

      {open && (
        <div className="space-y-2 bg-slate-50/60 px-3 pb-3">
          {input != null && (
            <div>
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Input
              </p>
              <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all rounded border border-slate-200 bg-white p-2 font-mono text-[11px] text-slate-600">
                {typeof input === "string" ? input : JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {hasOutput && (
            <div>
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Output
              </p>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded border border-slate-200 bg-white p-2 font-mono text-[11px] text-slate-600">
                {typeof output === "string"
                  ? output
                  : JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TracePanel({ messages }: { messages: UIMessage[] }) {
  const toolParts = messages.flatMap((m) =>
    m.role === "assistant" ? m.parts.filter(isToolUIPart) : []
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-200/80 px-3 py-2.5">
        <p className="text-xs font-semibold text-slate-700">Tool Calls</p>
        <p className="text-[11px] text-slate-400">{toolParts.length} invocation{toolParts.length !== 1 ? "s" : ""}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {toolParts.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-slate-400">
            No tool calls yet.
          </p>
        ) : (
          toolParts.map((part, i) => (
            <ToolCallRow key={toolPartCallId(part) ?? `trace-${i}`} part={part} />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assistant tool cards — one bubble each, above the text reply
// ---------------------------------------------------------------------------

function AssistantToolCard({ part }: { part: AnyPart }) {
  const [open, setOpen] = useState(false);

  if (!isToolUIPart(part)) return null;

  const name = toolPartName(part);
  const hasOutput =
    (part as { state?: string }).state === "output-available" &&
    (part as { output?: unknown }).output != null;
  const input = (part as { input?: unknown }).input;
  const output = (part as { output?: unknown }).output;

  return (
    <div className="max-w-[min(100%,42rem)] rounded-2xl border border-slate-200/80 bg-white text-sm text-slate-800 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-2xl px-4 py-2.5 text-left hover:bg-slate-50/80"
      >
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        />
        <Wrench className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
        <span className="flex-1 truncate font-mono text-xs font-semibold text-slate-700">
          {name}
        </span>
        {hasOutput ? (
          <span className="shrink-0 text-xs font-medium text-green-600">Done</span>
        ) : (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-500" aria-hidden />
        )}
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
          {input != null && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Parameters
              </p>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 font-mono text-[11px] text-slate-600">
                {typeof input === "string" ? input : JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {hasOutput && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Result
              </p>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 font-mono text-[11px] text-slate-600">
                {typeof output === "string"
                  ? output
                  : JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const textParts = message.parts.filter(isTextUIPart);
  const toolParts = message.parts.filter(isToolUIPart);

  if (textParts.length === 0 && toolParts.length === 0) return null;

  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div className="max-w-[min(100%,42rem)] rounded-2xl bg-slate-900 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">
          {textParts.map((part, i) => (
            <p key={i} className="whitespace-pre-wrap break-words">
              {part.text}
            </p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-start gap-2">
      {toolParts.map((part, i) => (
        <AssistantToolCard key={toolPartCallId(part) ?? `tool-${i}`} part={part} />
      ))}
      {textParts.length > 0 && (
        <div className="max-w-[min(100%,42rem)] rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm">
          {textParts.map((part, i) => (
            <p key={i} className="whitespace-pre-wrap break-words">
              {part.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat session (inner — has useChat)
// ---------------------------------------------------------------------------

type PreviewChatSessionProps = {
  agentId: string;
  userId: string;
  sessionId: string;
  initialMessages: UIMessage[];
  showTrace: boolean;
};

function PreviewChatSession({
  agentId,
  userId,
  sessionId,
  initialMessages,
  showTrace,
}: PreviewChatSessionProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingImagesRef = useRef<string[]>([]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/preview/chat",
        body: { agent_id: agentId, user_id: userId, session_id: sessionId },
        prepareSendMessagesRequest: ({ id, messages, body: reqBody, trigger, messageId }) => ({
          body: {
            ...reqBody,
            id,
            messages,
            trigger,
            messageId,
            message: extractLastUserText(messages) ?? "",
            images: pendingImagesRef.current,
          },
        }),
      }),
    [agentId, userId, sessionId]
  );

  const { messages, sendMessage, status, error, stop } = useChat({
    id: `preview-${agentId}-${sessionId}`,
    messages: initialMessages,
    transport,
  });

  const [input, setInput] = useState("");
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = status === "streaming" || status === "submitted";

  const onPickImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("user_id", userId);
      const res = await fetch(`/api/preview/upload?agent_id=${encodeURIComponent(agentId)}`, {
        method: "POST",
        body: form,
      });
      const json = await res.json() as { public_url?: string; error?: string };
      if (!res.ok || !json.public_url) throw new Error(json.error ?? "Upload failed");
      setAttachedImages((prev) => [...prev, json.public_url!]);
    } catch (err) {
      console.error("Image upload failed:", err);
    } finally {
      setUploading(false);
    }
  }, [agentId, userId]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if ((!text && attachedImages.length === 0) || busy || !agentId.trim() || !sessionId) return;
      pendingImagesRef.current = [...attachedImages];
      setInput("");
      setAttachedImages([]);
      await sendMessage({ text: text || " " });
    },
    [input, attachedImages, busy, agentId, sessionId, sendMessage]
  );

  return (
    <div className="flex h-full min-h-0">
      {/* ── Main chat ── */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-28 pt-4">
          {messages.length === 0 && (
            <p className="text-center text-sm text-slate-400">
              No messages yet. Say something below.
            </p>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm text-slate-500 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Thinking…
              </div>
            </div>
          )}
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-center text-sm text-red-600">
              {error.message || "Something went wrong"}
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={onSubmit}
          className="absolute inset-x-0 bottom-0 border-t border-slate-200/80 bg-white/95 p-4 backdrop-blur"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-2">
            {/* Image thumbnails */}
            {attachedImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachedImages.map((url, i) => (
                  <div key={url} className="relative h-16 w-16 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`attachment-${i}`}
                      className="h-full w-full rounded-lg border border-slate-200 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setAttachedImages((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-white hover:bg-slate-900"
                      aria-label="Remove image"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void onPickImage(e)}
              />
              {/* Image attach button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy || uploading}
                className="shrink-0 self-end rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40"
                aria-label="Attach image"
              >
                {uploading
                  ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  : <ImagePlus className="h-5 w-5" aria-hidden />
                }
              </button>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void onSubmit(e);
                  }
                }}
                placeholder="Message the agent…"
                rows={2}
                disabled={busy}
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-inner outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
              />
              {busy ? (
                <button
                  type="button"
                  onClick={() => stop()}
                  className="shrink-0 self-end rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() && attachedImages.length === 0}
                  className="flex shrink-0 items-center justify-center self-end rounded-xl bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800 disabled:opacity-40"
                  aria-label="Send"
                >
                  <SendHorizontal className="h-5 w-5" aria-hidden />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* ── Trace panel (sliding) ── */}
      <div
        className={`shrink-0 overflow-hidden border-l border-slate-200/80 bg-white transition-[width] duration-200 ${
          showTrace ? "w-72" : "w-0"
        }`}
      >
        <TracePanel messages={messages} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Outer shell — toolbar + session management
// ---------------------------------------------------------------------------

function sessionLabel(s: SessionSummary): string {
  const short = s.id.length > 14 ? `${s.id.slice(0, 12)}…` : s.id;
  const ended = s.ended_at ? " (ended)" : "";
  return `${short} · ${s.event_count} events${ended}`;
}

export function PreviewChat() {
  const { agentId } = useAgentId();
  const [userIdInput, setUserIdInput] = useState("");
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [sessionList, setSessionList] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [bootMessages, setBootMessages] = useState<UIMessage[] | null>(null);
  const [bootSeq, setBootSeq] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [showTrace, setShowTrace] = useState(false);

  useEffect(() => {
    setUserIdInput(loadStoredUserIdInput());
  }, []);

  useEffect(() => {
    setActiveUserId(null);
    setActiveSessionId(null);
    setSessionList([]);
    setBootMessages(null);
    setConnectError(null);
  }, [agentId]);

  const loadMessagesForSession = useCallback(async (sid: string) => {
    setHistoryLoading(true);
    try {
      const msgs = await fetchSessionUiMessages(sid);
      setBootMessages(msgs);
      setBootSeq((s) => s + 1);
    } catch {
      setBootMessages([]);
      setBootSeq((s) => s + 1);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const connect = useCallback(async () => {
    const uid = userIdInput.trim();
    if (!uid || !agentId.trim()) return;
    setConnecting(true);
    setConnectError(null);
    try {
      const listRes = await listAgentSessionsForUser(agentId, uid);
      let sessions = [...listRes.sessions];
      let sid: string;
      if (sessions.length === 0) {
        const created = await createAgentSession(agentId, uid);
        sessions = [created];
        sid = created.id;
      } else {
        const pick = pickDefaultSession(sessions);
        sid = pick!.id;
      }
      saveStoredUserIdInput(uid);
      setActiveUserId(uid);
      setSessionList(sessions);
      setActiveSessionId(sid);
      await loadMessagesForSession(sid);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setConnectError(msg);
      setActiveUserId(null);
      setActiveSessionId(null);
      setSessionList([]);
      setBootMessages(null);
    } finally {
      setConnecting(false);
    }
  }, [agentId, userIdInput, loadMessagesForSession]);

  const onSessionSelect = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      if (!id || id === activeSessionId) return;
      setActiveSessionId(id);
      await loadMessagesForSession(id);
    },
    [activeSessionId, loadMessagesForSession]
  );

  const newSession = useCallback(async () => {
    if (!activeUserId || !agentId.trim()) return;
    setConnecting(true);
    setConnectError(null);
    try {
      const created = await createAgentSession(agentId, activeUserId);
      setSessionList((prev) => [created, ...prev]);
      setActiveSessionId(created.id);
      setBootMessages([]);
      setBootSeq((s) => s + 1);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }, [activeUserId, agentId]);

  if (!agentId.trim()) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-500">
        <p>Select an agent in the header to use preview chat.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-slate-50/40">
      {/* ── Toolbar ── */}
      <div className="shrink-0 space-y-2 border-b border-slate-200/80 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1 className="text-sm font-semibold text-slate-800">Preview</h1>
          <div className="flex min-w-0 max-w-full flex-1 flex-wrap items-center justify-end gap-x-2 gap-y-2 sm:max-w-none sm:flex-initial">
            <span className="shrink-0 text-xs font-medium text-slate-600">User ID</span>
            <input
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              placeholder="UUID or user_…"
              aria-label="User ID"
              className={`min-w-0 max-w-[min(100%,14rem)] flex-1 ${previewToolbarControl} sm:w-[16rem] sm:max-w-[16rem] sm:flex-none`}
              disabled={connecting}
            />
            <button
              type="button"
              onClick={() => void connect()}
              disabled={connecting || !userIdInput.trim()}
              className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            >
              {connecting ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Working…
                </span>
              ) : (
                "Load sessions"
              )}
            </button>

            {activeUserId && (
              <>
                <span className="ml-1 hidden h-4 w-px shrink-0 bg-slate-200 sm:block" aria-hidden />
                <span className="shrink-0 text-xs font-medium text-slate-600">Session</span>
                <select
                  value={activeSessionId ?? ""}
                  onChange={(e) => void onSessionSelect(e)}
                  disabled={connecting || historyLoading}
                  aria-label="Session"
                  className={`min-w-0 max-w-[min(100%,16rem)] cursor-pointer ${previewToolbarControl} sm:w-[14rem] sm:max-w-[16rem] sm:flex-none`}
                >
                  {sessionList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {sessionLabel(s)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void newSession()}
                  disabled={connecting}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <PlusCircle className="h-3.5 w-3.5" aria-hidden />
                  New session
                </button>
              </>
            )}

            {/* Trace toggle */}
            <span className="ml-1 hidden h-4 w-px shrink-0 bg-slate-200 sm:block" aria-hidden />
            <button
              type="button"
              onClick={() => setShowTrace((v) => !v)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                showTrace
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Wrench className="h-3.5 w-3.5" aria-hidden />
              Trace
            </button>
          </div>
        </div>
        {connectError && (
          <p className="text-xs text-red-600 break-all">{connectError}</p>
        )}
      </div>

      {/* ── Content ── */}
      <div className="relative min-h-0 flex-1">
        {!activeUserId && (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-400">
            Enter a user id and click &quot;Load sessions&quot; to connect.
          </div>
        )}
        {activeUserId && historyLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
            <Loader2 className="h-8 w-8 animate-spin text-slate-300" aria-hidden />
          </div>
        )}
        {activeUserId && activeSessionId && bootMessages !== null && (
          <PreviewChatSession
            key={`${agentId}-${activeSessionId}-${bootSeq}`}
            agentId={agentId}
            userId={activeUserId}
            sessionId={activeSessionId}
            initialMessages={bootMessages}
            showTrace={showTrace}
          />
        )}
      </div>
    </div>
  );
}
