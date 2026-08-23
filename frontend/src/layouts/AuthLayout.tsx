import { Outlet } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo dark />
        </div>
        <div className="rounded-2xl border border-line bg-white p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
