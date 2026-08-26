/**
 * Central place for reading Vite env vars, so the rest of the app never
 * touches `import.meta.env` directly and callers get a typed shape.
 */
const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

// When VITE_API_URL is relative (e.g. "/api", same-origin behind an
// ingress/reverse proxy), stripping "/api" leaves "" — and unlike
// `undefined`/`null`, socket.io-client's URL parser does NOT treat an
// empty string as "default to the current page origin", it tries to parse
// it as a host and breaks. `|| undefined` restores that same-origin
// default for the relative case while leaving any real absolute URL as-is.
const derivedSocketUrl =
  (import.meta.env.VITE_SOCKET_URL ?? apiUrl.replace(/\/api\/?$/, '')) ||
  undefined;

export const env = {
  apiUrl,
  socketUrl: derivedSocketUrl,
} as const;
