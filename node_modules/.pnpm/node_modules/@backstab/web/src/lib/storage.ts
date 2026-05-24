// FIXED: #17 — safe localStorage wrapper
function safeGet(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, val: string): void {
  try { window.localStorage.setItem(key, val); } catch { /* silent */ }
}
function safeRemove(key: string): void {
  try { window.localStorage.removeItem(key); } catch { /* silent */ }
}
export const storage = { get: safeGet, set: safeSet, remove: safeRemove };
