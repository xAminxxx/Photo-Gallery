import { Component, Input, ViewChild, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../services/auth.service'; // Import AuthService

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
  ]
})
export class SidebarComponent implements AfterViewInit {
  @Input() isLoggedIn = false;

  @ViewChild('sidenav') sidenav: any;

  constructor(private router: Router, 
              private observer: BreakpointObserver, 
              private cdr: ChangeDetectorRef,
              private authService: AuthService) {} // Inject AuthService

  ngAfterViewInit() {
    this.observer.observe(['(max-width: 800px)']).subscribe((res: { matches: boolean }) => {
      if (res.matches) {
        // handle mobile layout
      } else {
        // handle desktop layout
      }
      this.cdr.detectChanges();  // Ensure UI updates
    });
  }

  toggleSidebar(): void {
    const pageWrapper = document.querySelector('.page-wrapper');
    if (pageWrapper) {
      pageWrapper.classList.toggle('toggled'); 
    }
  }

  // Update SignOut method to use AuthService's logout()
  SignOut(event: Event): void {
    event.preventDefault();  // Prevent default anchor link behavior
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);  // Redirect to login page
      },
    });
  }
}
