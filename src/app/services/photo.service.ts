import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  runTransaction,
  collection,
  collectionData,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { docData } from '@angular/fire/firestore';
import { orderBy, query, limit } from 'firebase/firestore';

interface PhotoEngagement {
  id: string;
  likes: number;
}

@Injectable({ providedIn: 'root' })
export class PhotoService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  getLikesCount(photoId: string): Observable<number> {
    const photoRef = doc(this.firestore, `photos/${photoId}`);
    return docData(photoRef).pipe(
      map((data) => data?.['likes'] || 0),
      catchError(() => of(0))
    );
  }

  getDownloadsCount(photoId: string): Observable<number> {
    const photoRef = doc(this.firestore, `photos/${photoId}`);
    return docData(photoRef).pipe(
      map((data) => data?.['downloads'] || 0),
      catchError(() => of(0))
    );
  }
  getTopLikedPhotos(resultLimit: number): Observable<PhotoEngagement[]> {
    const photosRef = collection(this.firestore, 'photos');
    const q = query(photosRef, orderBy('likes', 'desc'), limit(resultLimit));

    return collectionData(q, { idField: 'id' }).pipe(
      map((docs: any[]) =>
        docs.map((doc) => ({
          id: doc.id,
          likes: doc.likes || 0,
        }))
      )
    );
  }

  hasUserLiked(photoId: string): Observable<boolean> {
    const user = this.auth.currentUser;
    if (!user) return of(false);

    const userLikeRef = doc(
      this.firestore,
      `photos/${photoId}/likes/${user.uid}`
    );
    return docData(userLikeRef).pipe(map((data) => !!data));
  }

  hasUserDownloaded(photoId: string): Observable<boolean> {
    const user = this.auth.currentUser;
    if (!user) return of(false);

    const userDownloadRef = doc(
      this.firestore,
      `photos/${photoId}/downloads/${user.uid}`
    );
    return docData(userDownloadRef).pipe(map((data) => !!data));
  }

  toggleLike(photoId: string): Observable<void> {
    return from(this.handleLikeTransaction(photoId));
  }

  private async handleLikeTransaction(photoId: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const photoRef = doc(this.firestore, `photos/${photoId}`);
    const userLikeRef = doc(collection(photoRef, 'likes'), user.uid);

    return runTransaction(this.firestore, async (transaction) => {
      const [photoDoc, userLikeDoc] = await Promise.all([
        transaction.get(photoRef),
        transaction.get(userLikeRef),
      ]);

      const currentLikes = photoDoc.data()?.['likes'] || 0;
      let newLikes = currentLikes;

      if (userLikeDoc.exists()) {
        transaction.delete(userLikeRef);
        newLikes = Math.max(currentLikes - 1, 0);
      } else {
        transaction.set(userLikeRef, { timestamp: new Date() });
        newLikes = currentLikes + 1;
      }

      transaction.set(photoRef, { likes: newLikes }, { merge: true });
    });
  }

  recordDownload(photoId: string): Observable<void> {
    return from(this.handleDownloadTransaction(photoId));
  }

  private async handleDownloadTransaction(photoId: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const photoRef = doc(this.firestore, `photos/${photoId}`);
    const userDownloadRef = doc(collection(photoRef, 'downloads'), user.uid);

    return runTransaction(this.firestore, async (transaction) => {
      const [photoDoc, userDownloadDoc] = await Promise.all([
        transaction.get(photoRef),
        transaction.get(userDownloadRef),
      ]);

      const currentDownloads = photoDoc.data()?.['downloads'] || 0;

      if (!userDownloadDoc.exists()) {
        transaction.set(userDownloadRef, { timestamp: new Date() });
        transaction.set(
          photoRef,
          { downloads: currentDownloads + 1 },
          { merge: true }
        );
      }
    });
  }
}
