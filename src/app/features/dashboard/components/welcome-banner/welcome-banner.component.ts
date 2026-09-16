import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-welcome-banner',
  templateUrl: './welcome-banner.component.html',
  styleUrls: ['./welcome-banner.component.css']
})
export class WelcomeBannerComponent implements OnInit {
  @Output() newMeetingRequested = new EventEmitter<void>();
  @Output() joinMeetingRequested = new EventEmitter<void>();
  @Output() outreachRequested = new EventEmitter<void>();

  userName = 'Usuario';

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.userName = user.name.split(' ')[0]; // First name
      }
    });
  }

  onNewMeeting(): void {
    this.newMeetingRequested.emit();
  }

  onJoinMeeting(): void {
    this.joinMeetingRequested.emit();
  }

  onOutreach(): void {
    this.outreachRequested.emit();
  }
}
