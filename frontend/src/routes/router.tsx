import { lazy } from 'react';
import type { ComponentType } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { CustomerLayout } from '../layouts/CustomerLayout';
import { SellerLayout } from '../layouts/SellerLayout';
import { AdminLayout } from '../layouts/AdminLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { ProtectedRoute } from './ProtectedRoute';

import { HomePage } from '../pages/customer/HomePage';
import { CatalogPage } from '../pages/customer/CatalogPage';
import { ProductDetailPage } from '../pages/customer/ProductDetailPage';
import { CartPage } from '../pages/customer/CartPage';
import { CheckoutPage } from '../pages/customer/CheckoutPage';
import { AccountPage } from '../pages/customer/AccountPage';
import { AccountOrdersPage } from '../pages/customer/AccountOrdersPage';
import { OrderDetailPage } from '../pages/customer/OrderDetailPage';
import { SellerApplicationPage } from '../pages/customer/SellerApplicationPage';
import { LoginPage } from '../pages/customer/LoginPage';
import { RegisterPage } from '../pages/customer/RegisterPage';
import { AuthCallbackPage } from '../pages/customer/AuthCallbackPage';

import { UnauthorizedPage } from '../pages/UnauthorizedPage';
import { NotFoundPage } from '../pages/NotFoundPage';

/**
 * Seller/admin dashboard pages are only ever reached behind their role
 * gate (ProtectedRoute + DashboardShell), so a plain customer never pays
 * for their code. `lazyNamed` just adapts this codebase's named exports
 * to what `React.lazy` expects (a module with a `default` export).
 * DashboardShell wraps the shared <Outlet /> in one <Suspense>, so this
 * is the only place that needs to change to cover both sections.
 */
function lazyNamed<T extends ComponentType>(
  factory: () => Promise<Record<string, T>>,
  exportName: string,
) {
  return lazy(() =>
    factory().then((module) => ({ default: module[exportName] })),
  );
}

const SellerOverviewPage = lazyNamed(
  () => import('../pages/seller/SellerOverviewPage'),
  'SellerOverviewPage',
);
const SellerProductsPage = lazyNamed(
  () => import('../pages/seller/SellerProductsPage'),
  'SellerProductsPage',
);
const SellerOrdersPage = lazyNamed(
  () => import('../pages/seller/SellerOrdersPage'),
  'SellerOrdersPage',
);
const SellerOrderDetailPage = lazyNamed(
  () => import('../pages/seller/SellerOrderDetailPage'),
  'SellerOrderDetailPage',
);
const SellerAuctionsPage = lazyNamed(
  () => import('../pages/seller/SellerAuctionsPage'),
  'SellerAuctionsPage',
);
const SellerAuctionDetailPage = lazyNamed(
  () => import('../pages/seller/SellerAuctionDetailPage'),
  'SellerAuctionDetailPage',
);
const SellerDisputesPage = lazyNamed(
  () => import('../pages/seller/SellerDisputesPage'),
  'SellerDisputesPage',
);

const AdminOverviewPage = lazyNamed(
  () => import('../pages/admin/AdminOverviewPage'),
  'AdminOverviewPage',
);
const AdminSellersPage = lazyNamed(
  () => import('../pages/admin/AdminSellersPage'),
  'AdminSellersPage',
);
const AdminCategoriesPage = lazyNamed(
  () => import('../pages/admin/AdminCategoriesPage'),
  'AdminCategoriesPage',
);
const AdminOrdersPage = lazyNamed(
  () => import('../pages/admin/AdminOrdersPage'),
  'AdminOrdersPage',
);
const AdminOrderDetailPage = lazyNamed(
  () => import('../pages/admin/AdminOrderDetailPage'),
  'AdminOrderDetailPage',
);
const AdminDisputesPage = lazyNamed(
  () => import('../pages/admin/AdminDisputesPage'),
  'AdminDisputesPage',
);
const AdminAnalyticsPage = lazyNamed(
  () => import('../pages/admin/AdminAnalyticsPage'),
  'AdminAnalyticsPage',
);
const AdminAuctionsPage = lazyNamed(
  () => import('../pages/admin/AdminAuctionsPage'),
  'AdminAuctionsPage',
);
const AdminAuctionDetailPage = lazyNamed(
  () => import('../pages/admin/AdminAuctionDetailPage'),
  'AdminAuctionDetailPage',
);

export const router = createBrowserRouter([
  {
    element: <CustomerLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/catalog', element: <CatalogPage /> },
      { path: '/product/:id', element: <ProductDetailPage /> },
      {
        path: '/cart',
        element: (
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <CartPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/checkout',
        element: (
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <CheckoutPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/account',
        element: (
          <ProtectedRoute>
            <AccountPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/account/orders',
        element: (
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <AccountOrdersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/account/orders/:id',
        element: (
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <OrderDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/account/seller',
        element: (
          <ProtectedRoute>
            <SellerApplicationPage />
          </ProtectedRoute>
        ),
      },
      { path: '/unauthorized', element: <UnauthorizedPage /> },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/auth/callback', element: <AuthCallbackPage /> },
    ],
  },
  {
    path: '/seller',
    element: (
      <ProtectedRoute allowedRoles={['SELLER']}>
        <SellerLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <SellerOverviewPage /> },
      { path: 'products', element: <SellerProductsPage /> },
      { path: 'orders', element: <SellerOrdersPage /> },
      { path: 'orders/:id', element: <SellerOrderDetailPage /> },
      { path: 'auctions', element: <SellerAuctionsPage /> },
      { path: 'auctions/:id', element: <SellerAuctionDetailPage /> },
      { path: 'disputes', element: <SellerDisputesPage /> },
    ],
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <AdminOverviewPage /> },
      { path: 'sellers', element: <AdminSellersPage /> },
      { path: 'categories', element: <AdminCategoriesPage /> },
      { path: 'orders', element: <AdminOrdersPage /> },
      { path: 'orders/:id', element: <AdminOrderDetailPage /> },
      { path: 'disputes', element: <AdminDisputesPage /> },
      { path: 'analytics', element: <AdminAnalyticsPage /> },
      { path: 'auctions', element: <AdminAuctionsPage /> },
      { path: 'auctions/:id', element: <AdminAuctionDetailPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
