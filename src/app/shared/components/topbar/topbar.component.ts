import { Component, OnInit, ElementRef, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { UiStateService } from '../../../core/services/ui-state.service';
import { AuthService } from '../../../core/services/auth.service';
import { JoinRequestService } from '../../../core/services/join-request.service';
import { WebmasterService, PendingHost } from '../../../core/services/webmaster.service';
import { User } from '../../../core/models/user.model';
import { JoinRequest } from '../../../core/models/join-request.model';

@Component({
  selector: 'app-topbar',
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.css']
})
export class TopbarComponent implements OnInit {
  currentUser$: Observable<User | null>;
  isWebmaster$: Observable<boolean>;
  notificationCount$: Observable<number>;
  pendingHosts$: Observable<PendingHost[]>;
  pendingRoomRequests$: Observable<JoinRequest[]>;
  
  showDropdown = false;

  constructor(
    private uiStateService: UiStateService,
    private authService: AuthService,
    private joinRequestService: JoinRequestService,
    private webmasterService: WebmasterService,
    private router: Router,
    private elementRef: ElementRef
  ) {
    this.currentUser$ = this.authService.currentUser$;
    this.isWebmaster$ = this.currentUser$.pipe(
      map(user => user?.role === 'Webmaster')
    );
    this.pendingHosts$ = this.webmasterService.pendingHosts$;
    this.pendingRoomRequests$ = this.joinRequestService.getPendingRequests();

    this.notificationCount$ = combineLatest([
      this.isWebmaster$,
      this.webmasterService.pendingHostsCount$,
      this.joinRequestService.getPendingCount()
    ]).pipe(
      map(([isWm, hostCount, roomCount]) => isWm ? hostCount : roomCount)
    );
  }

  ngOnInit(): void {}

  toggleMenu(): void {
    this.uiStateService.toggleSidebar();
  }

  toggleNotifications(): void {
    this.showDropdown = !this.showDropdown;
  }

  closeDropdown(): void {
    this.showDropdown = false;
  }

  navigateToNotifications(isWm: boolean): void {
    this.closeDropdown();
    if (isWm) {
      this.router.navigate(['/webmaster/dashboard']);
    } else {
      this.router.navigate(['/solicitudes']);
    }
  }

  onLogout(): void {
    this.closeDropdown();
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.showDropdown = false;
    }
  }
}

