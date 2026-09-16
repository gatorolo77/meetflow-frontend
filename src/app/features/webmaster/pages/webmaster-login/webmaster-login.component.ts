import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { WebmasterService } from '../../../../core/services/webmaster.service';

@Component({
  selector: 'app-webmaster-login',
  templateUrl: './webmaster-login.component.html',
  styleUrls: ['./webmaster-login.component.css']
})
export class WebmasterLoginComponent implements OnInit {
  email = 'webmaster@meetflow.com';
  password = '';
  errorMessage = '';
  isLoading = false;

  // Parameters passed via email link
  invitedEmail = '';
  inviteToken = '';
  hostName = '';
  applicationSubmitted = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private webmasterService: WebmasterService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['email']) {
        this.email = params['email'];
        this.invitedEmail = params['email'];
      }
      if (params['token']) {
        this.inviteToken = params['token'];
      }
    });
  }

  onSubmit(): void {
    if (!this.email || !this.email.trim()) {
      this.errorMessage = 'Por favor, ingresa tu correo de Webmaster.';
      return;
    }
    if (!this.password || !this.password.trim()) {
      this.errorMessage = 'Por favor, ingresa tu contraseña de Webmaster.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.loginWebmaster(this.email, this.password).subscribe(res => {
      this.isLoading = false;
      if (res.success) {
        this.router.navigate(['/webmaster/dashboard']);
      } else {
        this.errorMessage = res.message || 'Error al autenticar el Webmaster.';
      }
    });
  }

  onSubmitHostApplication(): void {
    if (!this.hostName || !this.hostName.trim()) {
      this.errorMessage = 'Por favor, ingresa tu nombre completo.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.webmasterService.applyForHost(this.hostName, this.invitedEmail).subscribe(() => {
      this.isLoading = false;
      this.applicationSubmitted = true;
    });
  }

  goToUserLogin(event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    this.router.navigate(['/login']);
  }
}


