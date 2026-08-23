import { NotYetAvailable } from '../../components/ui/NotYetAvailable';

export function AdminSellersPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold text-navy">Sellers</h1>
      <NotYetAvailable feature="Seller application review" />
    </div>
  );
}
