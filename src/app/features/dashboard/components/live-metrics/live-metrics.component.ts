import { Component, Input } from '@angular/core';
import { LiveMeetingMetrics } from '../../../../core/models/meeting.model';

@Component({
  selector: 'app-live-metrics',
  templateUrl: './live-metrics.component.html',
  styleUrls: ['./live-metrics.component.css']
})
export class LiveMetricsComponent {
  @Input() metrics: LiveMeetingMetrics = {
    connectedParticipants: 8,
    activeMicrophones: 5,
    activeCameras: 6,
    screenShares: 2,
    connectionQualityLabel: 'Óptima (Excelente)'
  };
}
