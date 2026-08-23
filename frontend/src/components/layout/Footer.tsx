import { Logo } from '../ui/Logo';

const FOOTER_COLUMNS = [
  {
    heading: 'Shop',
    links: ['Catalog', 'Deals', 'Auctions', 'New arrivals'],
  },
  {
    heading: 'Sell',
    links: ['Become a seller', 'Seller dashboard', 'Commission rates'],
  },
  {
    heading: 'Support',
    links: ['Track an order', 'Returns & disputes', 'Contact the crew'],
  },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-navy text-paper/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Logo dark />
          <p className="max-w-xs text-sm">
            A marketplace built like a loading dock: every seller gets their own stall, every order gets tracked
            crate by crate.
          </p>
        </div>
        {FOOTER_COLUMNS.map((column) => (
          <div key={column.heading} className="flex flex-col gap-2.5">
            <h4 className="text-sm font-semibold text-paper">{column.heading}</h4>
            {column.links.map((link) => (
              <span key={link} className="text-sm">
                {link}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-paper/50 sm:px-6">
        © {new Date().getFullYear()} Cargo Crew. Built for a technical assessment — not a real store.
      </div>
    </footer>
  );
}
