import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { map, tap } from 'rxjs/operators';
import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.isAuthenticated$.pipe(
    // If not authenticated, redirect to login

    // OPTION 1: Using tap to handle side effects
    // // tap is to perform side effects before returning the value,
    // // map is to transform the value
    // // for example logging or navigation
    // tap((isAuthenticated) => {
    //   if (!isAuthenticated) {
    //     console.log('🚫 Access denied - User not authenticated');
    //     router.navigate(['/auth']);
    //   } else {
    //     console.log('✅ Access granted - User authenticated');
    //   }
    // }),
    // // Return the authentication state
    // // map is transforming the observable value to the same value
    // map((isAuthenticated) => isAuthenticated)

    // OPTION 2: using createUrlTree for redirection
    map((isAuthenticated) =>
      isAuthenticated ? true : router.createUrlTree(['/auth'])
    )
  );
};
