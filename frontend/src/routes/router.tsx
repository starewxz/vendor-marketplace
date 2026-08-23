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
import { AccountPage } from '../pages/customer/AccountPage';
import { LoginPage } from '../pages/customer/LoginPage';
import { RegisterPage } from '../pages/customer/RegisterPage';

import { SellerOverviewPage } from '../pages/seller/SellerOverviewPage';
import { SellerProductsPage } from '../pages/seller/SellerProductsPage';
import { SellerOrdersPage } from '../pages/seller/SellerOrdersPage';
import { SellerAuctionsPage } from '../pages/seller/SellerAuctionsPage';

import { AdminOverviewPage } from '../pages/admin/AdminOverviewPage';
import { AdminSellersPage } from '../pages/admin/AdminSellersPage';
import { AdminCategoriesPage } from '../pages/admin/AdminCategoriesPage';
import { AdminDisputesPage } from '../pages/admin/AdminDisputesPage';
import { AdminAnalyticsPage } from '../pages/admin/AdminAnalyticsPage';

import { NotFoundPage } from '../pages/NotFoundPage';

/**
 * /seller and /admin aren't wrapped in ProtectedRoute yet: doing so would
 * make their shells unreachable in this stage since no real login exists to
 * satisfy the guard. /account demonstrates the guard mechanism end-to-end;
 * role-based guarding of /seller and /admin lands with real auth in Stage 2.
 */
export const router = createBrowserRouter([
  {
    element: <CustomerLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/catalog', element: <CatalogPage /> },
      { path: '/product/:id', element: <ProductDetailPage /> },
      { path: '/cart', element: <CartPage /> },
      {
        path: '/account',
        element: (
          <ProtectedRoute>
            <AccountPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    path: '/seller',
    element: <SellerLayout />,
    children: [
      { index: true, element: <SellerOverviewPage /> },
      { path: 'products', element: <SellerProductsPage /> },
      { path: 'orders', element: <SellerOrdersPage /> },
      { path: 'auctions', element: <SellerAuctionsPage /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminOverviewPage /> },
      { path: 'sellers', element: <AdminSellersPage /> },
      { path: 'categories', element: <AdminCategoriesPage /> },
      { path: 'disputes', element: <AdminDisputesPage /> },
      { path: 'analytics', element: <AdminAnalyticsPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
