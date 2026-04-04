const USER_INPUT_KEY = "votrix-builder.preview-user-id-input";

/** Last user-entered end-user id (opaque string; backend accepts UUID or prefixed short id). */
export function loadStoredUserIdInput(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(USER_INPUT_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function saveStoredUserIdInput(id: string): void {
  try {
    const t = id.trim();
    if (t) localStorage.setItem(USER_INPUT_KEY, t);
    else localStorage.removeItem(USER_INPUT_KEY);
  } catch {
    /* ignore */
  }
}
