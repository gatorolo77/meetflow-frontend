import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { JoinRequestService } from '../../../../core/services/join-request.service';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {
  loginMode: 'REGISTERED' | 'GUEST' = 'REGISTERED';

  // Registered User Form State
  emailInput = 'sergio.d@meetflow.com';
  passwordInput = '12345678';
  errorMessage = '';
  returnUrl = '/dashboard';

  // Guest Code Form State
  guestNameInput = '';
  guestCodeInput = '';
  guestErrorMessage = '';
  showHardwareTest = false;

  // Guest Waiting Room State
  showWaitingModal = false;
  waitingRequestStatus: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING';
  pendingRequestId = '';
  targetMeetingCode = '';
  private requestSub?: Subscription;

  // Avatar Upload State
  hostAvatarPreview: string | null = null;
  guestAvatarPreview: string | null = null;

  registeredUsers: User[] = [];

  constructor(
    private authService: AuthService,
    private joinRequestService: JoinRequestService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.registeredUsers = this.authService.getRegisteredUsers();
    
    const qParams = this.route.snapshot.queryParams;
    const returnUrlParam = qParams['returnUrl'];
    
    let extractedCode = qParams['code'];
    if (!extractedCode && returnUrlParam && returnUrlParam.includes('/meetings/')) {
      extractedCode = returnUrlParam.split('/meetings/')[1];
    }

    const isGuestLink = qParams['mode'] === 'GUEST' || !!extractedCode;

    // Only redirect registered users to dashboard if NOT opening an explicit guest meeting link
    if (!isGuestLink && this.authService.isLoggedIn() && !this.authService.isGuest()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    if (returnUrlParam) {
      this.returnUrl = returnUrlParam;
    }

    if (isGuestLink) {
      this.loginMode = 'GUEST';
      if (extractedCode) {
        this.guestCodeInput = extractedCode;
      }
      if (qParams['guestName']) {
        this.guestNameInput = qParams['guestName'];
      } else if (qParams['email']) {
        this.guestNameInput = qParams['email'].split('@')[0];
      }

      // Automatically trigger guest hardware check -> waiting room flow when opening email invitation link
      if (qParams['autoJoin'] === 'true' || (qParams['code'] && (qParams['guestName'] || qParams['email']))) {
        setTimeout(() => {
          this.onSubmitGuest();
        }, 150);
      }
    }
  }

  ngOnDestroy(): void {
    this.requestSub?.unsubscribe();
  }

  onAvatarSelected(event: Event, target: 'HOST' | 'GUEST'): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (target === 'HOST') {
          this.hostAvatarPreview = result;
        } else {
          this.guestAvatarPreview = result;
        }
      };
      reader.readAsDataURL(file);
    }
  }

  removeAvatar(target: 'HOST' | 'GUEST'): void {
    if (target === 'HOST') {
      this.hostAvatarPreview = null;
    } else {
      this.guestAvatarPreview = null;
    }
  }

  selectDemoUser(email: string): void {
    this.emailInput = email;
    this.passwordInput = '12345678';
    this.errorMessage = '';
    const user = this.registeredUsers.find(u => u.email === email);
    if (user) {
      this.hostAvatarPreview = user.avatarUrl;
    }
  }

  onSubmitRegistered(): void {
    this.errorMessage = '';
    
    if (!this.emailInput || !this.emailInput.trim()) {
      this.errorMessage = 'Por favor, ingresa tu correo electrónico registrado.';
      return;
    }

    if (!this.passwordInput || !this.passwordInput.trim()) {
      this.errorMessage = 'Por favor, ingresa tu contraseña para acceder.';
      return;
    }

    this.authService.login(this.emailInput, this.passwordInput, this.hostAvatarPreview || undefined).subscribe(res => {
      if (res.success) {
        this.router.navigateByUrl(this.returnUrl);
      } else {
        this.errorMessage = res.message || 'Error al iniciar sesión.';
      }
    });
  }

  onSubmitGuest(): void {
    this.guestErrorMessage = '';

    if (!this.guestNameInput.trim()) {
      this.guestErrorMessage = 'Por favor, ingresa tu nombre completo.';
      return;
    }

    if (!this.guestCodeInput.trim()) {
      this.guestErrorMessage = 'Por favor, ingresa el código o enlace de invitación.';
      return;
    }

    // Login as guest with optional avatar
    this.authService.loginAsGuest(this.guestNameInput.trim(), this.guestAvatarPreview || undefined).subscribe(res => {
      if (res.success) {
        // Open hardware test pre-flight modal before sending join request
        this.showHardwareTest = true;
      }
    });
  }

  onHardwareConfirmed(event: { micEnabled: boolean; camEnabled: boolean; guestName?: string }): void {
    this.showHardwareTest = false;
    let targetCode = this.guestCodeInput.trim();
    if (targetCode.includes('/meetings/')) {
      targetCode = targetCode.split('/meetings/')[1];
    }
    this.targetMeetingCode = targetCode;

    if (event.guestName && event.guestName.trim()) {
      this.guestNameInput = event.guestName.trim();
      this.authService.loginAsGuest(this.guestNameInput, this.guestAvatarPreview || undefined).subscribe();
    }

    // Create a new Join Request for the host's Dashboard!
    const newReq = this.joinRequestService.createRequest(
      this.guestNameInput, 
      targetCode, 
      this.guestAvatarPreview || undefined
    );
    this.pendingRequestId = newReq.id;
    this.waitingRequestStatus = 'PENDING';
    this.showWaitingModal = true;

    // Listen to real-time status changes (e.g. host approving on Dashboard)
    this.requestSub?.unsubscribe();
    this.requestSub = this.joinRequestService.watchRequest(newReq.id).subscribe(req => {
      if (!req) return;
      this.waitingRequestStatus = req.status;

      if (req.status === 'APPROVED') {
        setTimeout(() => {
          this.showWaitingModal = false;
          this.router.navigate(['/meetings', this.targetMeetingCode]);
        }, 1200); // 1.2s smooth transition message
      }
    });
  }

  cancelRequest(): void {
    if (this.pendingRequestId) {
      this.joinRequestService.rejectRequest(this.pendingRequestId);
    }
    this.requestSub?.unsubscribe();
    this.showWaitingModal = false;
    this.authService.logout();
  }

  closeHardwareTest(): void {
    this.showHardwareTest = false;
  }
}

