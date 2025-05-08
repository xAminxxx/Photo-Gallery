import { Component, inject, OnDestroy, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Firestore,
  doc,
  getDoc,
  runTransaction,
} from '@angular/fire/firestore';
import { AuthService } from '../services/auth.service';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { environment } from '../environments/environment';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent implements OnInit, OnDestroy {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  isLoggedIn = false;

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

  // Cloudinary default avatar
  defaultAvatar =
    'https://res.cloudinary.com/drh28rj03/image/upload/v1625678901/default-avatar.png';

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

      // Upload new photo to Cloudinary if selected
      if (this.selectedFile) {
        photoURL = await this.uploadToCloudinary(this.selectedFile);
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

  private async uploadToCloudinary(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', environment.cloudinary.uploadPreset);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${environment.cloudinary.cloudName}/image/upload`,
      { method: 'POST', body: formData }
    );

    if (!response.ok) {
      throw new Error('Image upload failed');
    }

    const data = await response.json();
    return data.secure_url;
  }

  handleImageError(event: Event) {
    (event.target as HTMLImageElement).src = this.defaultAvatar;
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.ngZone.run(() => this.router.navigate(['/home'])),
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
