import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    navigate(query.trim() ? `/catalog?search=${encodeURIComponent(query.trim())}` : '/catalog');
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-2xl items-center">
      <div className="flex w-full items-center rounded-full border border-navy/25 bg-white py-1 pr-1.5 pl-5 transition-colors focus-within:border-crew-blue">
        <svg
          className="h-5 w-5 shrink-0 text-navy/45"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search products, categories or sellers…"
          aria-label="Search products"
          className="w-full bg-transparent px-3 py-2 text-[15px] text-navy placeholder:text-navy/40 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery('')}
            className="shrink-0 rounded-full p-1.5 text-navy/40 hover:bg-cream hover:text-navy"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" /></svg>
          </button>
        )}
        <button
          type="submit"
          className="shrink-0 rounded-full bg-cargo-yellow px-5 py-2 text-sm font-bold text-navy transition-colors hover:bg-cargo-yellow-dark active:translate-y-px"
        >
          Search
        </button>
      </div>
    </form>
  );
}
