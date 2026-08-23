import { env } from '../../config/env';

/**
 * A plain link, not a click handler — OAuth needs a full top-level
 * navigation to Google, which an XHR/fetch can't do. If Google OAuth isn't
 * configured on the backend, GET /auth/google responds with a clear 400
 * instead of crashing, so this never silently fails.
 */
export function GoogleLoginButton() {
  return (
    <a
      href={`${env.apiUrl}/auth/google`}
      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold text-navy hover:border-navy"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.52 12.27c0-.85-.08-1.67-.22-2.46H12v4.66h6.47a5.54 5.54 0 0 1-2.4 3.64v3h3.88c2.27-2.09 3.57-5.17 3.57-8.84Z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3a7.4 7.4 0 0 1-11-3.89H.98v3.09A12 12 0 0 0 12 24Z"
        />
        <path
          fill="#FBBC05"
          d="M5.07 14.21a7.2 7.2 0 0 1 0-4.42V6.7H.98a12 12 0 0 0 0 10.6l4.09-3.09Z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69.98 6.7l4.09 3.09A7.18 7.18 0 0 1 12 4.75Z"
        />
      </svg>
      Continue with Google
    </a>
  );
}
