import { Link } from 'react-router-dom';

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2 shrink-0">
      <svg width="32" height="32" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path
          d="M18 4H56C58.2091 4 60 5.79086 60 8V56C60 58.2091 58.2091 60 56 60H8C5.79086 60 4 58.2091 4 56V18L18 4Z"
          fill="#FFC629"
        />
        <path d="M18 4V14C18 16.2091 16.2091 18 14 18H4" stroke="#10162B" strokeWidth="4" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="4" fill="#FFFDF7" />
        <rect x="26" y="30" width="26" height="6" rx="3" fill="#10162B" />
        <rect x="26" y="42" width="18" height="6" rx="3" fill="#1E4FD8" />
      </svg>
      <span className={`font-display text-xl font-bold leading-none ${dark ? 'text-paper' : 'text-navy'}`}>
        Cargo Crew
      </span>
    </Link>
  );
}
