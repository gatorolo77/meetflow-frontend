import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MeetingService } from '../../../../core/services/meeting.service';
import { Meeting } from '../../../../core/models/meeting.model';

@Component({
  selector: 'app-meetings-page',
  templateUrl: './meetings-page.component.html',
  styleUrls: ['./meetings-page.component.css']
})
export class MeetingsPageComponent implements OnInit {
  activeMeetings$: Observable<Meeting[]>;
  showNewMeetingModal = false;

  showHardwareTest = false;
  targetMeetingId = 'm-101';
  targetMeetingTitle = 'Reunión de equipo - Sync Diario';

  constructor(
    private meetingService: MeetingService,
    private router: Router
  ) {
    this.activeMeetings$ = this.meetingService.getUpcomingMeetings().pipe(
      map(meetings => meetings.filter(m => m.isLive))
    );
  }

  ngOnInit(): void {}

  openNewMeetingModal(): void {
    this.showNewMeetingModal = true;
  }

  closeNewMeetingModal(): void {
    this.showNewMeetingModal = false;
  }

  openHardwareTest(meetingId: string, title: string): void {
    this.targetMeetingId = meetingId;
    this.targetMeetingTitle = title;
    this.showHardwareTest = true;
  }

  closeHardwareTest(): void {
    this.showHardwareTest = false;
  }

  onHardwareConfirmed(event: { micEnabled: boolean; camEnabled: boolean }): void {
    this.showHardwareTest = false;
    this.router.navigate(['/meetings', this.targetMeetingId]);
  }
}
