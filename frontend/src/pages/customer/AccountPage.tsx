import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../features/auth/useAuth';

export function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-navy">Your account</h1>

      <Card className="flex items-center justify-between border border-line p-5">
        <div>
          <p className="font-semibold text-navy">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-sm text-navy/60">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {user.role !== 'CUSTOMER' && <Badge tone={user.role === 'ADMIN' ? 'coral' : 'mint'}>{user.role}</Badge>}
          <Button variant="ghost" size="sm" onClick={handleLogout}>Log out</Button>
        </div>
      </Card>

      {user.role === 'CUSTOMER' && (
        <Link to="/account/orders">
          <Card className="flex items-center justify-between border border-line p-5 transition-colors hover:border-navy/25">
            <div>
              <p className="font-display text-lg font-bold text-navy">Your orders</p>
              <p className="text-sm text-navy/60">Track deliveries, leave reviews, or open a dispute.</p>
            </div>
            <span className="text-crew-blue" aria-hidden="true">→</span>
          </Card>
        </Link>
      )}

      {user.role === 'SELLER' && (
        <Link to="/seller">
          <Card className="flex items-center justify-between border border-line p-5 transition-colors hover:border-navy/25">
            <div>
              <p className="font-display text-lg font-bold text-navy">Seller dashboard</p>
              <p className="text-sm text-navy/60">Manage your products, orders, and auctions.</p>
            </div>
            <span className="text-crew-blue" aria-hidden="true">→</span>
          </Card>
        </Link>
      )}

      {user.role === 'ADMIN' && (
        <Link to="/admin">
          <Card className="flex items-center justify-between border border-line p-5 transition-colors hover:border-navy/25">
            <div>
              <p className="font-display text-lg font-bold text-navy">Admin dashboard</p>
              <p className="text-sm text-navy/60">Review operations, disputes, and platform analytics.</p>
            </div>
            <span className="text-crew-blue" aria-hidden="true">→</span>
          </Card>
        </Link>
      )}

      {user.role === 'CUSTOMER' && (
        <Link to="/account/seller" className="text-sm font-semibold text-navy/50 hover:text-crew-blue">
          Want to sell here? Apply to open a stall →
        </Link>
      )}
    </div>
  );
}
