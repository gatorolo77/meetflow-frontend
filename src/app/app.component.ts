import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  isStandaloneView = false;

  constructor(private router: Router) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const url = event.urlAfterRedirects;
      const isMercadoLibro = url.includes('/landing') || url.includes('/libro');

      // Standalone views: Landing, Libro, Login and Active Video Meeting Room
      this.isStandaloneView = isMercadoLibro ||
                             url.includes('/login') || 
                             url.includes('/meetings/m-') || 
                             (url.includes('/meetings/') && url !== '/meetings');

      // Favicon y Título dinámicos para MercadoLibro vs MeetFlow
      if (isMercadoLibro) {
        this.updateFavicon('assets/favicon.png', 'image/png');
        document.title = 'MercadoLibro - Plataforma de Libros & Cultura';
      } else {
        this.updateFavicon('assets/logo.ico', 'image/x-icon');
        document.title = 'MeetFlow - Plataforma de Videoconferencias & Colaboración';
      }
    });
  }

  private updateFavicon(faviconUrl: string, type: string): void {
    let faviconLink = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (!faviconLink) {
      faviconLink = document.createElement('link');
      faviconLink.rel = 'icon';
      document.head.appendChild(faviconLink);
    }
    faviconLink.type = type;
    faviconLink.href = faviconUrl;
  }
}
