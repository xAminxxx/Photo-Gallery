import { Component, OnInit } from '@angular/core';
import { createClient, PhotosWithTotalResults } from 'pexels';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../environments/environment';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar.component'; // Import SidebarComponent

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  standalone: true,
  imports: [CommonModule, SidebarComponent], // Include SidebarComponent here
})
export class HomeComponent implements OnInit {
  photos: any[] = [];
  loading = true;
  error: string | null = null;
  private readonly pexelsClient = createClient(environment.pexelsApiKey);
  isLoggedIn = false;

  private readonly LIKES_KEY = 'pexels_likes';
  private readonly DOWNLOADS_KEY = 'pexels_downloads';

  constructor(
    private http: HttpClient,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadPopularPhotos();

    this.authService.isAuthenticated().subscribe((loggedIn) => {
      this.isLoggedIn = loggedIn;
    });
  }

  signOut(): void {
    this.authService.logout();
    this.isLoggedIn = false;
    this.router.navigate(['/login']);
  }

  async loadPopularPhotos(): Promise<void> {
    try {
      const response = await this.pexelsClient.photos.curated({
        per_page: 30,
        page: 1,
      });
      if ('photos' in response) {
        this.photos = (response as PhotosWithTotalResults).photos.map(
          (photo: any) => ({
            ...photo,
            likes: this.getStoredLikes(photo.id),
            downloads: this.getStoredDownloads(photo.id),
            liked: this.hasLiked(photo.id),
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

    const currentLikeStatus = this.hasLiked(photoId);

    if (currentLikeStatus) {
      const likes = Math.max(this.getStoredLikes(photoId) - 1, 0);
      localStorage.setItem(`${this.LIKES_KEY}_${photoId}`, likes.toString());
      localStorage.removeItem(`liked_${photoId}`);
    } else {
      const likes = this.getStoredLikes(photoId) + 1;
      localStorage.setItem(`${this.LIKES_KEY}_${photoId}`, likes.toString());
      localStorage.setItem(`liked_${photoId}`, 'true');
    }

    this.updatePhotoStats(photoId, 'likes', this.getStoredLikes(photoId));
  }

  downloadPhoto(photo: any): void {
    if (!this.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }

    if (!this.hasDownloaded(photo.id)) {
      const downloads = this.getStoredDownloads(photo.id) + 1;
      localStorage.setItem(
        `${this.DOWNLOADS_KEY}_${photo.id}`,
        downloads.toString()
      );
      localStorage.setItem(`downloaded_${photo.id}`, 'true');
      this.updatePhotoStats(photo.id, 'downloads', downloads);
    }

    const link = document.createElement('a');
    link.href = photo.src.original;
    link.download = `photo-${photo.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private getStoredLikes(photoId: number): number {
    return parseInt(
      localStorage.getItem(`${this.LIKES_KEY}_${photoId}`) || '0',
      10
    );
  }

  private getStoredDownloads(photoId: number): number {
    return parseInt(
      localStorage.getItem(`${this.DOWNLOADS_KEY}_${photoId}`) || '0',
      10
    );
  }

  private updatePhotoStats(
    photoId: number,
    type: 'likes' | 'downloads',
    value: number
  ): void {
    this.photos = this.photos.map((photo) => {
      if (photo.id === photoId) {
        return {
          ...photo,
          [type]: value,
          liked: type === 'likes' ? this.hasLiked(photoId) : photo.liked,
        };
      }
      return photo;
    });
  }

  private hasLiked(photoId: number): boolean {
    return localStorage.getItem(`liked_${photoId}`) === 'true';
  }

  private hasDownloaded(photoId: number): boolean {
    return localStorage.getItem(`downloaded_${photoId}`) === 'true';
  }
}
