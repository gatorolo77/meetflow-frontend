import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { JoinRequestService } from '../../core/services/join-request.service';
import { JoinRequest } from '../../core/models/join-request.model';

@Component({
  selector: 'app-join-requests-page',
  templateUrl: './join-requests-page.component.html',
  styleUrls: ['./join-requests-page.component.css']
})
export class JoinRequestsPageComponent {
  joinRequests$: Observable<JoinRequest[]>;

  constructor(private joinRequestService: JoinRequestService) {
    this.joinRequests$ = this.joinRequestService.getJoinRequests();
  }

  onApprove(id: string): void {
    this.joinRequestService.approveRequest(id);
  }

  onReject(id: string): void {
    this.joinRequestService.rejectRequest(id);
  }
}
