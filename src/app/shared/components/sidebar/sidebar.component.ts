import { Component, OnInit } from '@angular/core';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { JoinRequestService } from '../../../core/services/join-request.service';
import { WebmasterService } from '../../../core/services/webmaster.service';
import { AuthService } from '../../../core/services/auth.service';
import { UiStateService } from '../../../core/services/ui-state.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit {
  pendingRequestsCount$: Observable<number>;
  isWebmaster$: Observable<boolean>;
  isOpen$: Observable<boolean>;

  constructor(
    private joinRequestService: JoinRequestService,
    private webmasterService: WebmasterService,
    private authService: AuthService,
    private uiStateService: UiStateService
  ) {
    this.isOpen$ = this.uiStateService.isSidebarOpen$;
    this.isWebmaster$ = this.authService.currentUser$.pipe(
      map(user => user?.role === 'Webmaster')
    );
    this.pendingRequestsCount$ = combineLatest([
      this.isWebmaster$,
      this.webmasterService.pendingHostsCount$,
      this.joinRequestService.getPendingCount()
    ]).pipe(
      map(([isWm, hCount, rCount]) => isWm ? hCount : rCount)
    );
  }

  ngOnInit(): void {}

  closeSidebar(): void {
    this.uiStateService.closeSidebar();
  }
}

