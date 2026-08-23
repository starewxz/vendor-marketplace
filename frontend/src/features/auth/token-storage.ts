const ACCESS_TOKEN_KEY = 'cargo-crew.access-token';

/**
 * Isolated so the storage mechanism (localStorage today, httpOnly cookie
 * exchange later) can change without touching every call site.
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}
