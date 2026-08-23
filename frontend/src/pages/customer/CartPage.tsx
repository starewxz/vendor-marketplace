import { NotYetAvailable } from '../../components/ui/NotYetAvailable';

export function CartPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold text-navy">Your cart</h1>
      <NotYetAvailable feature="Cart" />
    </div>
  );
}
