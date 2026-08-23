import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';

const TILES = [
  {
    to: '/catalog?category=Deals',
    eyebrow: 'This week',
    heading: 'Deals worth unloading the truck for',
    tone: 'bg-navy text-paper',
    accent: 'text-cargo-yellow',
  },
  {
    to: '/seller',
    eyebrow: 'Auctions',
    heading: 'Bid live, win it before the gate closes',
    tone: 'bg-coral text-paper',
    accent: 'text-navy',
  },
  {
    to: '/seller',
    eyebrow: 'New here?',
    heading: 'Set up a stall and start shipping',
    tone: 'bg-crew-blue text-paper',
    accent: 'text-cargo-yellow',
  },
];

export function PromoTiles() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {TILES.map((tile) => (
        <Link key={tile.heading} to={tile.to}>
          <Card notch className={`flex h-full flex-col justify-between gap-6 border-0 p-5 ${tile.tone}`}>
            <span className={`text-xs font-semibold tracking-wide uppercase ${tile.accent}`}>{tile.eyebrow}</span>
            <h3 className="font-display text-xl font-semibold leading-tight">{tile.heading}</h3>
          </Card>
        </Link>
      ))}
    </div>
  );
}
