import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { JoinRequestService } from '../../../../core/services/join-request.service';
import { JoinRequest } from '../../../../core/models/join-request.model';

@Component({
  selector: 'app-join-requests-widget',
  templateUrl: './join-requests-widget.component.html',
  styleUrls: ['./join-requests-widget.component.css']
})
export class JoinRequestsWidgetComponent implements OnInit {
  pendingRequests$: Observable<JoinRequest[]>;

  constructor(private joinRequestService: JoinRequestService) {
    this.pendingRequests$ = this.joinRequestService.getPendingRequests();
  }

  ngOnInit(): void {}

  onApprove(id: string): void {
    this.joinRequestService.approveRequest(id);
  }

  onReject(id: string): void {
    this.joinRequestService.rejectRequest(id);
  }
}
