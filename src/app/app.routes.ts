import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.DashboardComponent)
  },
  {
    path: 'intervals',
    loadComponent: () => import('./pages/intervals-page/intervals-page').then(m => m.IntervalsPageComponent)
  },
  { path: '**', redirectTo: '' }
];
