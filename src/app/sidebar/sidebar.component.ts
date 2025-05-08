import {
  Component,
  Input,
  ViewChild,
  AfterViewInit,
  ChangeDetectorRef,
  OnDestroy,
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../services/auth.service';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
  ],
})
export class SidebarComponent implements AfterViewInit, OnDestroy {
  @Input() isLoggedIn = false;
  @ViewChild('sidenav') sidenav: any;

  username: string | null = null;
  userPhotoUrl: string | null = null;
  defaultAvatar =
    'https://res.cloudinary.com/drh28rj03/image/upload/v1/pexels-moh-adbelghaffar-771742_rrtw10';
  private authSub!: Subscription;

  constructor(
    private router: Router,
    private observer: BreakpointObserver,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private firestore: Firestore
  ) {}

  ngAfterViewInit() {
    // Watch authentication state
    this.authSub = this.authService.authState$.subscribe((user) => {
      if (user) {
        this.loadUserProfile(user.uid);
      } else {
        this.userPhotoUrl = null;
      }
    });

    // Responsive layout observer
    this.observer
      .observe(['(max-width: 800px)'])
      .subscribe((res: { matches: boolean }) => {
        if (res.matches) {
          // Handle mobile layout
        } else {
          // Handle desktop layout
        }
        this.cdr.detectChanges();
      });
  }

  async loadUserProfile(uid: string): Promise<void> {
    try {
      const userRef = doc(this.firestore, 'users', uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        this.userPhotoUrl = userData['photoURL'] || this.defaultAvatar;
        this.username = userData['username'] || null;
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      this.userPhotoUrl = this.defaultAvatar;
    }
    this.cdr.detectChanges();
  }

  toggleSidebar(): void {
    const pageWrapper = document.querySelector('.page-wrapper');
    if (pageWrapper) {
      pageWrapper.classList.toggle('toggled');
    }
  }

  SignOut(event: Event): void {
    event.preventDefault();
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/home']);
      },
    });
  }

  ngOnDestroy(): void {
    if (this.authSub) {
      this.authSub.unsubscribe();
    }
  }
}
