import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const isLoggedIn = this.authService.isLoggedIn();
    const isGuest = this.authService.isGuest();
    const targetUrl = state.url;

    // If user is a Guest, forbid access to internal Dashboard, Agenda, Solicitudes, Historial
    if (isLoggedIn && isGuest) {
      const isInternalRoute = targetUrl.includes('/dashboard') || 
                              targetUrl.includes('/agenda') || 
                              targetUrl.includes('/solicitudes') || 
                              targetUrl.includes('/historial') || 
                              targetUrl.includes('/modo-de-uso');
      if (isInternalRoute) {
        console.warn('Acceso denegado: Los invitados con código no tienen acceso al Dashboard interno.');
        this.router.navigate(['/login']);
        return false;
      }
      return true; // Guests can access /meetings/:id
    }

    if (isLoggedIn) {
      return true;
    }

    this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
}
