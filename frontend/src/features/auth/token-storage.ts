/**
 * Access token lives only in memory — never localStorage/sessionStorage —
 * so it can't be read by an XSS payload that persists across reloads. On a
 * hard reload it's gone by design; AuthProvider recovers it by calling
 * /auth/refresh on startup, which reads the httpOnly refresh cookie that
 * JS can never touch at all.
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
