import { Component, inject, OnDestroy, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Storage,
  ref,
  uploadBytes,
  getDownloadURL,
} from '@angular/fire/storage';
import {
  Firestore,
  doc,
  getDoc,
  runTransaction,
} from '@angular/fire/firestore';
import { AuthService } from '../services/auth.service';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent implements OnInit, OnDestroy {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private storage = inject(Storage);

  // Component state
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  currentUser: any = null;
  editMode = false;
  loading = true;
  errorMessage = '';
  successMessage = '';
  newUsername = '';
  private authSub!: Subscription;

  // Replace with your actual Firebase Storage URL
  defaultAvatar =
    'https://firebasestorage.googleapis.com/v0/b/task-manager-d765f.appspot.com/o/defaults%2Fdefault-avatar.png?alt=media';

  get shouldDisableSave(): boolean {
    if (!this.currentUser) return true;
    return (
      (this.newUsername === this.currentUser.username && !this.selectedFile) ||
      this.loading
    );
  }
  ngOnInit(): void {
    this.authSub = this.authService.authState$.subscribe((user) => {
      this.ngZone.run(() => {
        if (user) {
          this.loadUserProfile(user.uid);
        } else {
          this.router.navigate(['/login']);
        }
      });
    });
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file?.type.startsWith('image/')) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = (e) => (this.previewUrl = e.target?.result as string);
      reader.readAsDataURL(file);
    }
  }

  async loadUserProfile(uid: string): Promise<void> {
    try {
      const userRef = doc(this.firestore, 'users', uid);
      const userSnap = await getDoc(userRef);

      this.ngZone.run(() => {
        if (userSnap.exists()) {
          this.currentUser = { id: uid, ...userSnap.data() };
          this.newUsername = this.currentUser.username;
        } else {
          this.errorMessage = 'User profile not found';
        }
        this.loading = false;
      });
    } catch (error) {
      this.handleError('Error loading profile', error);
    }
  }

  async updateUsername(): Promise<void> {
    // Validate changes
    if (
      !this.currentUser ||
      (this.newUsername === this.currentUser.username && !this.selectedFile)
    ) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      let photoURL = this.currentUser.photoURL;

      // Upload new photo if selected
      if (this.selectedFile) {
        const storageRef = ref(
          this.storage,
          `profile-photos/${this.currentUser.id}`
        );
        const snapshot = await uploadBytes(storageRef, this.selectedFile);
        photoURL = await getDownloadURL(snapshot.ref);
      }

      // Update Firestore transaction
      await runTransaction(this.firestore, async (transaction) => {
        // Username change logic
        if (this.newUsername !== this.currentUser.username) {
          const usernameRef = doc(
            this.firestore,
            'usernames',
            this.newUsername
          );
          const usernameSnap = await transaction.get(usernameRef);

          if (usernameSnap.exists()) {
            throw new Error('Username is already taken');
          }

          const oldUsernameRef = doc(
            this.firestore,
            'usernames',
            this.currentUser.username
          );
          transaction.delete(oldUsernameRef);
          transaction.set(usernameRef, { userId: this.currentUser.id });
        }

        // Update user document
        const userRef = doc(this.firestore, 'users', this.currentUser.id);
        transaction.update(userRef, {
          username: this.newUsername,
          updatedAt: new Date(),
          ...(photoURL && { photoURL }),
        });
      });

      // Update local state
      this.ngZone.run(() => {
        this.currentUser.username = this.newUsername;
        if (photoURL) this.currentUser.photoURL = photoURL;
        this.selectedFile = null;
        this.previewUrl = null;
        this.successMessage = 'Profile updated successfully!';
        this.editMode = false;
        this.loading = false;
      });
    } catch (error: any) {
      this.handleError(error.message || 'Failed to update profile', error);
    }
  }

  handleImageError(event: Event) {
    (event.target as HTMLImageElement).src = this.defaultAvatar;
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.ngZone.run(() => this.router.navigate(['/login'])),
      error: (err) => this.ngZone.run(() => (this.errorMessage = err.message)),
    });
  }

  private handleError(message: string, error: any) {
    this.ngZone.run(() => {
      this.errorMessage = message;
      this.loading = false;
      console.error('Error:', error);
    });
  }

  ngOnDestroy(): void {
    if (this.authSub) {
      this.authSub.unsubscribe();
    }
  }
  onCancel() {
    this.editMode = false;
    this.newUsername = this.currentUser.username;
    this.selectedFile = null;
    this.previewUrl = null;
  }
}
