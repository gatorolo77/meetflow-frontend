import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { MeetingService } from '../../core/services/meeting.service';
import { SystemStatusService } from '../../core/services/system-status.service';
import { LiveMeetingMetrics } from '../../core/models/meeting.model';
import { ActivityLogItem } from '../../core/models/activity-log.model';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  liveMetrics$: Observable<LiveMeetingMetrics>;
  recentActivities$: Observable<ActivityLogItem[]>;

  showNewMeetingModal = false;
  showOutreachModal = false;
  modalInitialTab: 'CREATE' | 'JOIN' = 'CREATE';

  constructor(
    private meetingService: MeetingService,
    private systemStatusService: SystemStatusService
  ) {
    this.liveMetrics$ = this.meetingService.getLiveMetrics();
    this.recentActivities$ = this.systemStatusService.getRecentActivity();
  }

  ngOnInit(): void {}

  openNewMeetingModal(tab: 'CREATE' | 'JOIN' = 'CREATE'): void {
    this.modalInitialTab = tab;
    this.showNewMeetingModal = true;
  }

  closeNewMeetingModal(): void {
    this.showNewMeetingModal = false;
  }

  openOutreachModal(): void {
    this.showOutreachModal = true;
  }

  closeOutreachModal(): void {
    this.showOutreachModal = false;
  }
}
