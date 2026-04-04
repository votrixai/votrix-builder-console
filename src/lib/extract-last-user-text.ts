import { isTextUIPart, type UIMessage } from "ai";

/** Last user message text from AI SDK `UIMessage[]` (parts-based). */
export function extractLastUserText(
  messages: UIMessage[] | undefined
): string | null {
  if (!Array.isArray(messages)) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user" || !m.parts?.length) continue;
    const texts = m.parts.filter(isTextUIPart).map((p) => p.text);
    const joined = texts.join("");
    if (joined.trim()) return joined;
  }
  return null;
}
