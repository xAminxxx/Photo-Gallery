// src/app/services/auth.service.ts
import { Injectable, inject } from '@angular/core';
import { Auth, authState, User, deleteUser } from '@angular/fire/auth';
import { Firestore, runTransaction, doc } from '@angular/fire/firestore';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';
import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
} from 'firebase/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);

  // Reactive authentication state
  authState$: Observable<User | null> = authState(this.auth).pipe(
    shareReplay(1)
  );

  // Current user ID stream
  get userId$(): Observable<string | null> {
    return this.authState$.pipe(map((user) => user?.uid ?? null));
  }

  // Sign up with email/password and username
  signUp(
    email: string,
    password: string,
    username: string
  ): Observable<string> {
    return from(this.handleSignup(email, password, username)).pipe(
      catchError((error) => this.handleAuthError(error))
    );
  }

  private async handleSignup(
    email: string,
    password: string,
    username: string
  ): Promise<string> {
    let user: User | null = null;

    try {
      // 1. First create auth user
      const userCredential = await createUserWithEmailAndPassword(
        this.auth,
        email,
        password
      );
      user = userCredential.user;

      // 2. Atomic Firestore operations
      await runTransaction(this.firestore, async (transaction) => {
        // Check username availability
        const usernameRef = doc(this.firestore, 'usernames', username);
        const usernameDoc = await transaction.get(usernameRef);

        if (usernameDoc.exists()) {
          throw new Error('username-already-exists');
        }

        // Create username document with actual UID
        transaction.set(usernameRef, { userId: user!.uid });

        // Create user document
        const userRef = doc(this.firestore, 'users', user!.uid);
        transaction.set(userRef, {
          username,
          email,
          createdAt: new Date(),
          lastLogin: new Date(),
          emailVerified: false,
          profileComplete: false,
        });
      });

      return user.uid;
    } catch (error) {
      // Cleanup if any part failed
      if (user) {
        await deleteUser(user);
      }
      throw error;
    }
  }

  // Login with email/password
  login(email: string, password: string): Observable<void> {
    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(
      switchMap(() => this.authState$),
      map(() => {}),
      catchError((error) => this.handleAuthError(error))
    );
  }

  // Logout
  logout(): Observable<void> {
    return from(signOut(this.auth)).pipe(
      catchError((error) => this.handleAuthError(error))
    );
  }

  // Check authentication state
  isAuthenticated(): Observable<boolean> {
    return this.authState$.pipe(map((user) => !!user));
  }

  // Delete username reservation
  private async deleteUsernameReservation(username: string): Promise<void> {
    const usernameRef = doc(this.firestore, 'usernames', username);
    await runTransaction(this.firestore, async (transaction) => {
      transaction.delete(usernameRef);
    });
  }

  // Error handling
  private handleAuthError(error: any): Observable<never> {
    const errorMap: { [key: string]: string } = {
      'auth/invalid-email': 'Invalid email format',
      'auth/user-disabled': 'Account disabled',
      'auth/user-not-found': 'Account not found',
      'auth/wrong-password': 'Invalid password',
      'auth/email-already-in-use': 'Email already registered',
      'username-already-exists': 'Username is already taken',
      'auth/weak-password': 'Password should be at least 6 characters',
      'auth/operation-not-allowed': 'Email/password accounts are not enabled',
    };

    const message =
      errorMap[error.message] ||
      errorMap[error.code] ||
      'Authentication failed';
    return throwError(() => new Error(message));
  }

  // Automatic cleanup on browser close
  private clearAuthState(): void {
    localStorage.removeItem('firebase:authUser');
  }
}
