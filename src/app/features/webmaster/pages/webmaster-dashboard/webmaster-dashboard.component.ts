import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { WebmasterService, PendingHost } from '../../../../core/services/webmaster.service';

@Component({
  selector: 'app-webmaster-dashboard',
  templateUrl: './webmaster-dashboard.component.html',
  styleUrls: ['./webmaster-dashboard.component.css']
})
export class WebmasterDashboardComponent implements OnInit {
  pendingHosts: PendingHost[] = [];
  approvedCount = 4;
  rejectedCount = 1;
  isLoading = false;
  toastMessage = '';

  inviteEmail = '';
  inviteSending = false;
  lastGeneratedLink = '';

  constructor(
    private webmasterService: WebmasterService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.webmasterService.pendingHosts$.subscribe(hosts => {
      this.pendingHosts = hosts;
    });
    this.loadPendingHosts();
  }

  sendInvitation(): void {
    if (!this.inviteEmail || !this.inviteEmail.trim() || !this.inviteEmail.includes('@')) {
      this.showToast('⚠️ Por favor, ingresa un correo electrónico válido para la invitación.');
      return;
    }

    this.inviteSending = true;
    const emailToSend = this.inviteEmail.trim();

    this.webmasterService.sendHostInvitation(emailToSend).subscribe(res => {
      this.inviteSending = false;
      this.lastGeneratedLink = res.activationLink;
      this.inviteEmail = '';
      this.showToast(`📧 ¡Invitación enviada exitosamente a ${emailToSend}!`);
    });
  }

  copyLink(link: string): void {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link);
    }
    this.showToast('📋 ¡Enlace de invitación copiado al portapapeles!');
  }

  loadPendingHosts(): void {
    this.isLoading = true;
    this.webmasterService.loadPendingHosts().subscribe(() => {
      this.isLoading = false;
    });
  }

  approveHost(host: PendingHost): void {
    this.webmasterService.approveHost(host).subscribe(() => {
      this.approvedCount++;
      this.showToast(`✅ Anfitrión "${host.name}" ha sido APROBADO exitosamente.`);
    });
  }

  rejectHost(host: PendingHost): void {
    this.webmasterService.rejectHost(host).subscribe(() => {
      this.rejectedCount++;
      this.showToast(`✕ Solicitud de "${host.name}" ha sido rechazada.`);
    });
  }

  showToast(msg: string): void {
    this.toastMessage = msg;
    setTimeout(() => {
      this.toastMessage = '';
    }, 4500);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/webmaster/login']);
  }
}


