import { Component, OnInit } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { environment } from '../environments/environment';
import { AuthService } from '../services/auth.service';
import { PhotoService } from '../services/photo.service';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar.component';
import {
  Observable,
  catchError,
  forkJoin,
  from,
  map,
  of,
  switchMap,
} from 'rxjs';
import { createClient, Photo } from 'pexels';

interface PhotoWithLikes {
  id: string;
  likes: number;
  src: { large: string };
  alt: string;
  photographer: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: true,
  imports: [CommonModule, SidebarComponent, NgChartsModule],
})
export class DashboardComponent implements OnInit {
  photos: PhotoWithLikes[] = [];
  loading = true;
  error: string | null = null;
  isLoggedIn = false;

  // Chart.js Configuration
  barChartData!: ChartConfiguration<'bar'>['data'];
  barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    scales: {
      x: {
        title: { display: true, text: 'Number of Likes' },
        beginAtZero: true,
      },
      y: {
        title: { display: true, text: 'Photos' },
      },
    },
  };

  constructor(
    private authService: AuthService,
    private photoService: PhotoService
  ) {}

  ngOnInit(): void {
    this.authService.isAuthenticated().subscribe((loggedIn) => {
      this.isLoggedIn = loggedIn;
    });
    this.loadMostLikedPhotos();
    console.log('Loaded photos:', this.photos);
  }

  private loadMostLikedPhotos(): void {
    this.photoService
      .getTopLikedPhotos(5)
      .pipe(
        switchMap((firebasePhotos) => {
          const pexelsRequests = firebasePhotos.map((fp) =>
            from(this.fetchPexelsPhotoDetails(fp.id)).pipe(
              catchError(() => of(null)) // Handle missing Pexels photos
            )
          );
          return forkJoin(pexelsRequests).pipe(
            map((pexelsPhotos) =>
              pexelsPhotos
                .filter((p): p is Photo => !!p)
                .map((pexelsPhoto, index) => ({
                  id: firebasePhotos[index].id,
                  likes: firebasePhotos[index].likes,
                  src: { large: pexelsPhoto.src.large },
                  alt: pexelsPhoto.alt || '',
                  photographer: pexelsPhoto.photographer,
                }))
            )
          );
        })
      )
      .subscribe({
        next: (mergedPhotos) => {
          this.photos = mergedPhotos;
          this.updateChartData();
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Failed to load most liked photos';
          this.loading = false;
          console.error(err);
        },
      });
  }

  private async fetchPexelsPhotoDetails(photoId: string): Promise<Photo> {
    const client = createClient(environment.pexelsApiKey);
    const response = await client.photos.show({ id: parseInt(photoId) });
    if ('id' in response) return response;
    throw new Error('Photo not found in Pexels');
  }
  private updateChartData(): void {
    const labels = this.photos.map((photo) => `${photo.id.substr(0, 15)}...`); // Use the photo ID as part of the label
    const likes = this.photos.map((photo) => photo.likes);

    this.barChartData = {
      labels,
      datasets: [
        {
          label: 'Likes',
          data: likes,
          backgroundColor: 'rgba(255, 99, 132, 0.7)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1,
        },
      ],
    };
  }
}
