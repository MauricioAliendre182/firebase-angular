import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/auth',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    loadComponent: () => import('./components/auth/auth').then(m => m.Auth),
    title: 'Log in - Chat assistant',
  },
  {
    path: 'chat',
    loadComponent: () => import('./components/chat/chat').then(m => m.Chat),
    title: 'Chat - Assistant',
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: '/auth',
  }
];
