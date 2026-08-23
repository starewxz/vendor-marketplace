import { NotYetAvailable } from '../../components/ui/NotYetAvailable';

export function SellerProductsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold text-navy">Your products</h1>
      <NotYetAvailable feature="Product management" />
    </div>
  );
}
