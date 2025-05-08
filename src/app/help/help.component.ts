import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './help.component.html',
  styleUrls: ['./help.component.css'],
})
export class HelpComponent {
  isLoggedIn = false;
}
