import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { SystemStatusService } from '../../../../core/services/system-status.service';
import { SystemHealthSummary } from '../../../../core/models/system-status.model';

@Component({
  selector: 'app-system-status-widget',
  templateUrl: './system-status-widget.component.html',
  styleUrls: ['./system-status-widget.component.css']
})
export class SystemStatusWidgetComponent implements OnInit {
  systemHealth$: Observable<SystemHealthSummary>;

  constructor(private systemStatusService: SystemStatusService) {
    this.systemHealth$ = this.systemStatusService.getSystemHealth();
  }

  ngOnInit(): void {}
}
