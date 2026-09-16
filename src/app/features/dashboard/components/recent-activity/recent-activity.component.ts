import { Component, Input } from '@angular/core';
import { ActivityLogItem } from '../../../../core/models/activity-log.model';

@Component({
  selector: 'app-recent-activity',
  templateUrl: './recent-activity.component.html',
  styleUrls: ['./recent-activity.component.css']
})
export class RecentActivityComponent {
  @Input() activities: ActivityLogItem[] = [];
}
