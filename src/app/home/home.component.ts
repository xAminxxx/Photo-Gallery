import { Component, OnInit } from '@angular/core';
import { createClient, PhotosWithTotalResults } from 'pexels';
import { Router } from '@angular/router';
import { environment } from '../environments/environment';
import { AuthService } from '../services/auth.service';
import { PhotoService } from '../services/photo.service';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { Observable, switchMap } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  standalone: true,
  imports: [CommonModule, SidebarComponent],
})
export class HomeComponent implements OnInit {
  photos: any[] = [];
  loading = true;
  error: string | null = null;
  private readonly pexelsClient = createClient(environment.pexelsApiKey);
  isLoggedIn = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private photoService: PhotoService
  ) {}

  ngOnInit(): void {
    this.loadPopularPhotos();
    this.authService.isAuthenticated().subscribe((loggedIn) => {
      this.isLoggedIn = loggedIn;
    });
  }

  async loadPopularPhotos(): Promise<void> {
    try {
      const response = await this.pexelsClient.photos.curated({
        per_page: 30,
        page: 1,
      });

      if ('photos' in response) {
        this.photos = (response as PhotosWithTotalResults).photos.map(
          (photo) => ({
            ...photo,
            likes$: this.photoService.getLikesCount(photo.id.toString()),
            downloads$: this.photoService.getDownloadsCount(
              photo.id.toString()
            ),
            hasLiked$: this.photoService.hasUserLiked(photo.id.toString()),
            hasDownloaded$: this.photoService.hasUserDownloaded(
              photo.id.toString()
            ),
          })
        );
      }
      this.loading = false;
    } catch (err) {
      this.error = 'Failed to load photos. Please try again later.';
      this.loading = false;
    }
  }

  toggleLike(photoId: number): void {
    if (!this.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }

    this.photoService.toggleLike(photoId.toString()).subscribe({
      next: () => this.updatePhotoState(photoId),
      error: (err) => console.error('Error toggling like:', err),
    });
  }

  downloadPhoto(photo: any): void {
    if (!this.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }

    this.photoService
      .recordDownload(photo.id.toString())
      .pipe(
        switchMap(() => {
          const link = document.createElement('a');
          link.href = photo.src.original;
          link.download = `photo-${photo.id}.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          return this.photoService.getDownloadsCount(photo.id.toString());
        })
      )
      .subscribe({
        next: (downloads) => this.updatePhotoDownloads(photo.id, downloads),
        error: (err) => console.error('Download tracking failed:', err),
      });
  }

  private updatePhotoState(photoId: number): void {
    this.photos = this.photos.map((photo) => {
      if (photo.id === photoId) {
        return {
          ...photo,
          likes$: this.photoService.getLikesCount(photoId.toString()),
          hasLiked$: this.photoService.hasUserLiked(photoId.toString()),
        };
      }
      return photo;
    });
  }

  private updatePhotoDownloads(photoId: number, downloads: number): void {
    this.photos = this.photos.map((photo) => {
      if (photo.id === photoId) {
        return { ...photo, downloads };
      }
      return photo;
    });
  }

  signOut(): void {
    this.authService.logout();
    this.isLoggedIn = false;
    this.router.navigate(['/login']);
  }
}
