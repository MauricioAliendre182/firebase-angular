import { inject, Injectable } from '@angular/core';
import { Auth, GoogleAuthProvider, signInWithPopup, signOut, User, user } from '@angular/fire/auth';
import { map } from 'rxjs';
import { User as UserModel } from '../models/user';

@Injectable({
  // Hacemos que este servicio esté disponible en toda la aplicación
  providedIn: 'root',
})
export class AuthService {
  private auth = inject(Auth);

  // Creamos un Observable que nos permite saber si hay un usuario autenticado
  // Este Observable emite cada vez que cambia el estado de autenticación
  user$ = user(this.auth);

  // Observable que nos dice si el usuario está autenticado o no
  // pipe is to transform the observable data
  // in this case we transform the user object into a boolean
  isAuthenticated$ = this.user$.pipe(
    // Transformamos el usuario en un boolean: true si existe, false si no
    map(user => !!user)
  );

  async loginWithGoogle(): Promise<UserModel | null> {
    try {
      // Creamos el proveedor de Google para la autenticación
      const provider = new GoogleAuthProvider();

      // Configuramos los scopes que queremos obtener del usuario
      provider.addScope('email');
      provider.addScope('profile');

      // Abrimos el popup de Google para autenticación
      // signInWithPopup return a Promise with the user credential
      // first parameter is the Auth instance
      // second parameter is the provider we just created
      const result = await signInWithPopup(this.auth, provider);

      const userFirebase = result.user;

      if (userFirebase) {
        const user: UserModel = {
          uid: userFirebase.uid,
          email: userFirebase.email || '',
          name: userFirebase.displayName || 'No name user',
          photoUrl: userFirebase.photoURL || undefined,
          createdAt: new Date(),
          lastConnection: new Date()
        };

        return user;
      }

      return null;

    } catch (error) {
      console.error('❌ Error during authentication:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      // Usamos el método signOut de Firebase para cerrar la sesión
      // With signOut, user$ will automatically emit null
      await signOut(this.auth);

    } catch (error) {
      console.error('❌ Error during logout:', error);
      throw error;
    }
  }

  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  getUserUid(): string | null {
    const user = this.getCurrentUser();
    return user ? user.uid : null;
  }
}
