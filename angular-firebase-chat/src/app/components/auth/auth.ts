import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-auth',
  imports: [CommonModule],
  templateUrl: './auth.html',
  styleUrl: './auth.css'
})
export class Auth {

  private authService = inject(AuthService);
  private router = inject(Router);
  authenticating = false;
  errorMessage = '';

  async loginWithGoogle(): Promise<void> {
    this.errorMessage = '';
    this.authenticating = true;

    try {
      const user = await this.authService.loginWithGoogle();

      // Simulation of authentication service call (replace with the above line in production)
      // let user = null;
      // user = await new Promise((resolve) => {
      //   setTimeout(() => resolve({ nombre: 'Test user' }), 1000);
      // });

      if (user) {
        await this.router.navigate(['/chat']);

      } else {
        this.errorMessage = 'Could not retrieve user information';
        console.error('❌ No user information obtained');
      }

    } catch (error: any) {
      console.error('❌ Authentication error:', error);

      // error.code is specific to Firebase Auth errors
      // in this case code is a string like 'auth/popup-closed-by-user'
      // which means the user closed the popup without completing the sign-in
      if (error.code === 'auth/popup-closed-by-user') {
        this.errorMessage = 'You have closed the authentication window. Please try again.';
      } else if (error.code === 'auth/popup-blocked') {
        this.errorMessage = 'Your browser blocked the authentication window. Please allow popups and try again.';
      } else if (error.code === 'auth/network-request-failed') {
        this.errorMessage = 'Connection error. Please check your internet and try again.';
      } else {
        this.errorMessage = 'Error starting session. Please try again.';
      }

    } finally {
      this.authenticating = false;
    }
  }

  ngOnInit(): void {
    // Subscribe to authentication state changes
    // An observable could be used in AuthService to track authentication status
    this.authService.isAuthenticated$.subscribe(authenticated => {
      if (authenticated) {
        this.router.navigate(['/chat']);
      }
    });
  }
}
