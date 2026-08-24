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
      <h1 className="font-display text-2xl font-semibold text-navy">Your account</h1>

      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-navy">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-sm text-navy/60">{user.email}</p>
          </div>
          <Badge tone={user.role === 'ADMIN' ? 'coral' : user.role === 'SELLER' ? 'mint' : 'neutral'}>
            {user.role}
          </Badge>
        </div>
        <Button variant="ghost" className="w-fit" onClick={handleLogout}>
          Log out
        </Button>
      </Card>

      {user.role === 'CUSTOMER' && (
        <Card className="flex items-center justify-between gap-4 p-5">
          <div>
            <p className="font-semibold text-navy">Order history</p>
            <p className="text-sm text-navy/60">See everything you've ordered, seller by seller.</p>
          </div>
          <Link to="/account/orders">
            <Button variant="secondary">View your orders</Button>
          </Link>
        </Card>
      )}

      {user.role === 'CUSTOMER' && (
        <Card className="flex items-center justify-between gap-4 p-5">
          <div>
            <p className="font-semibold text-navy">Want to sell on Cargo Crew?</p>
            <p className="text-sm text-navy/60">Apply to open your own stall.</p>
          </div>
          <Link to="/account/seller">
            <Button variant="secondary">Apply to sell</Button>
          </Link>
        </Card>
      )}

      {user.role === 'SELLER' && (
        <Card className="flex items-center justify-between gap-4 p-5">
          <div>
            <p className="font-semibold text-navy">You're a seller</p>
            <p className="text-sm text-navy/60">Manage your stall from the seller dashboard.</p>
          </div>
          <Link to="/seller">
            <Button variant="secondary">Go to dashboard</Button>
          </Link>
        </Card>
      )}
      {user.role === 'ADMIN' && (
        <Card className="flex items-center justify-between gap-4 p-5">
          <div><p className="font-semibold text-navy">Marketplace control room</p><p className="text-sm text-navy/60">Review operations, disputes, and platform analytics.</p></div>
          <Link to="/admin"><Button variant="secondary">Go to admin</Button></Link>
        </Card>
      )}
    </div>
  );
}
