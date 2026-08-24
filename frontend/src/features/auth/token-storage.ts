/**
 * Access token lives only in memory — never localStorage/sessionStorage —
 * so it can't be read by an XSS payload that persists across reloads. On a
 * hard reload it's gone by design; AuthProvider recovers it by calling
 * /auth/refresh on startup, which reads the httpOnly refresh cookie that
 * JS can never touch at all.
 */
let accessToken: string | null = null;
const listeners = new Set<(token: string | null) => void>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  if (accessToken === token) return;
  accessToken = token;
  for (const listener of listeners) listener(token);
}

export function subscribeAccessToken(
  listener: (token: string | null) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
