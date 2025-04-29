import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule,RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email = '';
  password = '';
  errorMessage = '';

  private authService = inject(AuthService);
  private router = inject(Router);

  login(): void {
    this.errorMessage = ''; // Clear previous errors
    
    this.authService.login(this.email, this.password)
      .subscribe({
        next: () => {
          // Redirect to protected route
          this.router.navigate(['/home']);
        },
        error: (err) => {
          this.errorMessage = err.message;
          console.error('Login error:', err);
        }
      });
  }
}