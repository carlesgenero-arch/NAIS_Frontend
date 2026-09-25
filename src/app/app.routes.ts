import { Routes } from '@angular/router';
import { productResolver } from './features/shop/product.resolver';

export const routes: Routes = [
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
  { path: 'shop', pathMatch: 'full', redirectTo: 'products' },
  {
    path: 'cart',
    loadComponent: () => import('./features/components/cart/cart').then(module => module.Cart),
  },
];
