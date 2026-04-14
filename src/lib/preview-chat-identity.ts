const USER_INPUT_KEY = "votrix-builder.preview-user-id-input";
const USER_MAP_KEY = "votrix-builder.preview-user-map";

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

/** Returns cached UUID for a display name, or null if not found. */
export function loadCachedUserUUID(displayName: string): string | null {
  try {
    const raw = localStorage.getItem(USER_MAP_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[displayName] ?? null;
  } catch {
    return null;
  }
}

/** Persist display name → UUID mapping. */
export function saveCachedUserUUID(displayName: string, id: string): void {
  try {
    const raw = localStorage.getItem(USER_MAP_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[displayName] = id;
    localStorage.setItem(USER_MAP_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUUID(s: string): boolean {
  return UUID_RE.test(s);
}
