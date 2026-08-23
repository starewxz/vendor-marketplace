import { NotYetAvailable } from '../../components/ui/NotYetAvailable';

export function SellerOrdersPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold text-navy">Your orders</h1>
      <NotYetAvailable feature="Order fulfillment" />
    </div>
  );
}
