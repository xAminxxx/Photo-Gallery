// analytics.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { groupBy, orderBy, sum } from 'lodash-es';
import { format } from 'date-fns';

interface Photo {
  id: string;
  likesCount: number;
  downloadsCount: number;
  artistId: string;
  createdAt: Date;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  constructor(private firestore: Firestore) {}

  private async getPhotos(): Promise<Photo[]> {
    const photosRef = collection(this.firestore, 'photos');
    const snapshot = await getDocs(photosRef);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        likesCount: data['likesCount'] || 0,
        downloadsCount: data['downloadsCount'] || 0,
        artistId: data['artistId'] || '',
        createdAt: data['createdAt']?.toDate() || new Date(),
      } as Photo;
    });
  }

  async getChartData(
    metric: 'likesCount' | 'downloadsCount',
    interval: 'year' | 'month' | 'day'
  ) {
    const photos = await this.getPhotos();
    const grouped = this.groupByInterval(photos, interval, metric);

    return {
      labels: grouped.map((g) => g.label),
      datasets: [
        {
          label: metric === 'likesCount' ? 'Likes' : 'Downloads',
          data: grouped.map((g) => g.value),
          backgroundColor: this.getChartColors(metric),
          borderColor: '#3f51b5',
          tension: 0.4,
        },
      ],
    };
  }

  async getTopArtists() {
    const photos = await this.getPhotos();
    const grouped = groupBy(photos, 'artistId');

    const artists = orderBy(
      Object.keys(grouped).map((artistId) => ({
        artistId,
        total: sum(grouped[artistId].map((p) => p.likesCount)),
      })),
      'total',
      'desc'
    ).slice(0, 10);

    return {
      labels: artists.map((a) => a.artistId),
      datasets: [
        {
          label: 'Total Likes',
          data: artists.map((a) => a.total),
          backgroundColor: this.getChartColors('likesCount'),
        },
      ],
    };
  }

  private groupByInterval(
    data: Photo[],
    interval: 'year' | 'month' | 'day', // Changed from 'date'
    metric: 'likesCount' | 'downloadsCount'
  ) {
    const formatString = {
      year: 'yyyy',
      month: 'MMM yyyy',
      day: 'dd MMM yyyy', // Changed from 'date'
    }[interval];

    const grouped = groupBy(data, (item) =>
      format(item.createdAt, formatString)
    );

    return Object.keys(grouped).map((label) => ({
      label,
      value: sum(grouped[label].map((p) => p[metric])),
    }));
  }

  private getChartColors(metric: string) {
    return metric === 'likesCount'
      ? ['#3f51b5', '#2196f3', '#03a9f4']
      : ['#4caf50', '#8bc34a', '#cddc39'];
  }
}
