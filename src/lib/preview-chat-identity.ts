const USER_INPUT_KEY = "votrix-builder.preview-user-id-input";

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUUID(s: string): boolean {
  return UUID_RE.test(s);
}
