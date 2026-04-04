import { randomUUID } from "crypto";

type VotrixSsePayload =
  | { type: "token"; content?: string }
  | {
      type: "tool_start";
      tool_call_id?: string;
      name?: string;
      input?: Record<string, unknown>;
    }
  | { type: "tool_end"; tool_call_id?: string; output?: unknown }
  | { type: "done" }
  | { type: "error"; message?: string };

function parseSseDataLine(line: string): VotrixSsePayload | null {
  const trimmed = line.startsWith("data:") ? line.slice(5).trim() : line.trim();
  if (!trimmed || trimmed === "[DONE]") return null;
  try {
    return JSON.parse(trimmed) as VotrixSsePayload;
  } catch {
    return null;
  }
}

function encodeSse(part: object | string): Uint8Array {
  const line =
    typeof part === "string"
      ? `data: ${part}\n\n`
      : `data: ${JSON.stringify(part)}\n\n`;
  return new TextEncoder().encode(line);
}

/**
 * Converts Votrix backend chat SSE (token / tool_* / done / error) into
 * AI SDK UI message stream v1 (see Vercel stream protocol).
 */
export function votrixSseToAiUiMessageStream(
  backendBody: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
  const reader = backendBody.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const messageId = randomUUID();
  let started = false;
  let textId: string | null = null;

  function* ensureStart(): Generator<Uint8Array> {
    if (!started) {
      started = true;
      yield encodeSse({ type: "start", messageId });
    }
  }

  function* ensureText(): Generator<Uint8Array> {
    yield* ensureStart();
    if (!textId) {
      textId = randomUUID();
      yield encodeSse({ type: "text-start", id: textId });
    }
  }

  function* closeText(): Generator<Uint8Array> {
    if (textId) {
      yield encodeSse({ type: "text-end", id: textId });
      textId = null;
    }
  }

  function* handlePayload(payload: VotrixSsePayload): Generator<Uint8Array> {
    switch (payload.type) {
      case "token": {
        if (payload.content) {
          yield* ensureText();
          yield encodeSse({
            type: "text-delta",
            id: textId!,
            delta: payload.content,
          });
        }
        break;
      }
      case "tool_start": {
        yield* closeText();
        yield* ensureStart();
        const tcid = payload.tool_call_id || randomUUID();
        const toolName = payload.name || "tool";
        const toolInput =
          payload.input && typeof payload.input === "object" && !Array.isArray(payload.input)
            ? payload.input
            : {};
        yield encodeSse({
          type: "tool-input-start",
          toolCallId: tcid,
          toolName,
          dynamic: true,
        });
        yield encodeSse({
          type: "tool-input-available",
          toolCallId: tcid,
          toolName,
          input: toolInput,
          dynamic: true,
        });
        break;
      }
      case "tool_end": {
        const out =
          payload.output !== undefined && payload.output !== null
            ? payload.output
            : { status: "completed" as const };
        yield encodeSse({
          type: "tool-output-available",
          toolCallId: payload.tool_call_id || "",
          output: out,
        });
        break;
      }
      case "done": {
        yield* closeText();
        yield encodeSse({ type: "finish" });
        yield encodeSse("[DONE]");
        break;
      }
      case "error": {
        yield* closeText();
        yield encodeSse({
          type: "error",
          errorText: payload.message || "Unknown error",
        });
        yield encodeSse({ type: "finish" });
        yield encodeSse("[DONE]");
        break;
      }
      default:
        break;
    }
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sep: number;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const block = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const line = block.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            const payload = parseSseDataLine(line);
            if (!payload) continue;
            for (const chunk of handlePayload(payload)) {
              controller.enqueue(chunk);
            }
            if (payload.type === "done" || payload.type === "error") {
              controller.close();
              return;
            }
          }
        }
        for (const chunk of closeText()) {
          controller.enqueue(chunk);
        }
        controller.enqueue(encodeSse({ type: "finish" }));
        controller.enqueue(encodeSse("[DONE]"));
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}
