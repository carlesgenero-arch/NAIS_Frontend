import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home-page/home-page').then(module => module.HomePage),
  },
  {
    path: 'shop',
    loadComponent: () => import('./features/shop/shop-page/shop-page').then(module => module.ShopPage),
  },
];
