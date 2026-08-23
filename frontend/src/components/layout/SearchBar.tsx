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
    <form onSubmit={handleSubmit} className="flex w-full max-w-xl items-center">
      <div className="flex w-full items-center rounded-full border-2 border-navy bg-white pl-4 pr-1.5 py-1 focus-within:border-crew-blue">
        <svg
          className="h-4 w-4 shrink-0 text-navy/50"
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
          placeholder="Search crates, gadgets, deals…"
          aria-label="Search products"
          className="w-full bg-transparent px-3 py-1.5 text-sm text-navy placeholder:text-navy/40 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-cargo-yellow px-4 py-1.5 text-sm font-semibold text-navy hover:bg-cargo-yellow-dark"
        >
          Search
        </button>
      </div>
    </form>
  );
}
