import { Routes } from '@angular/router';

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
  },
  {
    path: '**',
    redirectTo: '/auth',
  }
];
