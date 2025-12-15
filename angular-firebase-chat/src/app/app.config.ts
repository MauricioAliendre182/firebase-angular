import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';

import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

import { envrionment } from '../environments/environment.prod';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    // We need to pass a function that initializes the Firebase app
    // this function will contain our env variables
    // This is to use the DB Firebase services
    provideFirebaseApp(() => {
      return initializeApp(envrionment.firebaseConfig);
    }),
    // provideAuth is to use the Firebase Auth services
    // We need to pass a function that initializes the Auth service
    // getAuth() initializes and returns the Auth instance associated with the default App
    provideAuth(() => {
      return getAuth();
    }),
    // This is to use the Firestore services for our DB
    provideFirestore(() => {
      // We can initialize and return the Firestore instance associated with the default App
      // using getFirestore() from 'firebase/firestore'
      return getFirestore();
    }),
  ],
};
