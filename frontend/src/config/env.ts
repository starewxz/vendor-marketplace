/**
 * Central place for reading Vite env vars, so the rest of the app never
 * touches `import.meta.env` directly and callers get a typed shape.
 */
export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
  socketUrl:
    import.meta.env.VITE_SOCKET_URL ??
    (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(
      /\/api\/?$/,
      '',
    ),
} as const;
