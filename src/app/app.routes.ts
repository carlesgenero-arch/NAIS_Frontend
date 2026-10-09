import { adminGuard } from './features/admin/admin.guard';
import { Routes } from '@angular/router';
import { productResolver } from './features/shop/product.resolver';

export const routes: Routes = [
  { path: 'admin/login', title: 'Accés | NAIS', loadComponent: () => import('./features/admin/admin-login').then(m => m.AdminLogin) },
  { path: 'admin', title: 'Backoffice | NAIS', canActivate: [adminGuard], canActivateChild: [adminGuard],
    loadComponent: () => import('./features/admin/admin-shell').then(m => m.AdminShell), children: [
      { path: 'orders', title: 'Comandes | NAIS Admin', loadComponent: () => import('./features/admin/orders/admin-orders').then(m => m.AdminOrders) },
      { path: 'orders/:id', title: 'Comanda | NAIS Admin', loadComponent: () => import('./features/admin/orders/admin-order-detail').then(m => m.AdminOrderDetail) },
      { path: 'products/new', title: 'Crear producte | NAIS Admin', loadComponent: () => import('./features/admin/products/admin-product-form').then(m => m.AdminProductForm) },
      { path: 'products/:id/edit', title: 'Editar producte | NAIS Admin', loadComponent: () => import('./features/admin/products/admin-product-form').then(m => m.AdminProductForm) },
      { path: 'products', title: 'Productes | NAIS Admin', loadComponent: () => import('./features/admin/products/admin-products').then(m => m.AdminProducts) },
    ] },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/prelaunch/prelaunch-landing/prelaunch-landing').then(module => module.PrelaunchLanding),
  },
  {
    // Keep the original homepage available while the temporary landing is active.
    path: 'home',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home-page/home-page').then(module => module.HomePage),
  },
  {
    path: 'products',
    pathMatch: 'full',
    loadComponent: () => import('./features/shop/shop-page/shop-page').then(module => module.ShopPage),
  },
  {
    path: 'products/:slug',
    resolve: { product: productResolver },
    loadComponent: () => import('./features/shop/shop-page/shop-page').then(module => module.ShopPage),
  },
  {
    path: 'checkout/success',
    title: 'Gràcies | NAIS',
    loadComponent: () => import('./features/checkout/checkout-success').then(module => module.CheckoutSuccess),
  },
  {
    path: 'checkout/cancel',
    title: 'Checkout cancel·lat | NAIS',
    loadComponent: () => import('./features/checkout/checkout-cancel').then(module => module.CheckoutCancel),
  },
  { path: 'shop', pathMatch: 'full', redirectTo: 'products' },
  {
    path: 'cart',
    loadComponent: () => import('./features/components/cart/cart').then(module => module.Cart),
  },
];
