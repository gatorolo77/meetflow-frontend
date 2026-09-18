import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Meeting } from '../../../../core/models/meeting.model';

@Component({
  selector: 'app-upcoming-meetings',
  templateUrl: './upcoming-meetings.component.html',
  styleUrls: ['./upcoming-meetings.component.css']
})
export class UpcomingMeetingsComponent {
  @Input() meetings: Meeting[] = [];
  @Output() delete = new EventEmitter<string>();

  getIconClass(title: string): string {
    if (title.includes('equipo')) return 'icon-blue';
    if (title.includes('Presentación')) return 'icon-leather';
    if (title.includes('Revisión')) return 'icon-purple';
    if (title.includes('Sprint')) return 'icon-teal';
    return 'icon-default';
  }

  onDeleteMeeting(meetingId: string): void {
    this.delete.emit(meetingId);
  }

  getParticipantCount(meeting: Meeting): number {
    if (meeting.finalParticipantCount !== undefined && meeting.finalParticipantCount !== null) {
      return meeting.finalParticipantCount;
    }
    return meeting.participants ? meeting.participants.length : 0;
  }

  getMeetingDuration(meeting: Meeting): string {
    if (meeting.endedDurationText) {
      return meeting.endedDurationText;
    }
    return `${meeting.durationMinutes} min`;
  }
}
