import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Router } from '@angular/router';
import { MeetingService } from '../../../core/services/meeting.service';

@Component({
  selector: 'app-new-meeting-modal',
  templateUrl: './new-meeting-modal.component.html',
  styleUrls: ['./new-meeting-modal.component.css']
})
export class NewMeetingModalComponent implements OnInit {
  @Input() initialTab: 'CREATE' | 'JOIN' = 'CREATE';
  @Output() closed = new EventEmitter<void>();

  activeTab: 'CREATE' | 'JOIN' = 'CREATE';
  
  // Create Room Form State
  titleInput = '';
  teamInput = '';
  enableWaitingRoom = true;
  startWithMic = true;
  startWithCam = true;

  // Join Room Form State
  codeInput = '';
  joinWithMic = true;
  joinWithCam = true;

  constructor(
    private meetingService: MeetingService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.activeTab = this.initialTab;
  }

  onClose(): void {
    this.closed.emit();
  }

  onCreateMeeting(): void {
    const title = this.titleInput.trim() || 'Nueva Sesión MeetFlow';
    const team = this.teamInput.trim() || 'General';
    const newMeeting = this.meetingService.createMeeting(title, team);
    this.onClose();
    this.router.navigate(['/meetings', newMeeting.id]);
  }

  onJoinMeeting(): void {
    if (this.codeInput.trim()) {
      let targetCode = this.codeInput.trim();
      // Extract room code if full URL was pasted
      if (targetCode.includes('/meetings/')) {
        targetCode = targetCode.split('/meetings/')[1];
      }
      this.onClose();
      this.router.navigate(['/meetings', targetCode]);
    }
  }
}
