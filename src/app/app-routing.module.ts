import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './features/auth/pages/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { MeetingsPageComponent } from './features/meetings/pages/meetings-page/meetings-page.component';
import { MeetingRoomComponent } from './features/meetings/pages/meeting-room/meeting-room.component';
import { AgendaComponent } from './features/agenda/agenda.component';
import { JoinRequestsPageComponent } from './features/join-requests/join-requests-page.component';
import { UsageModeComponent } from './features/usage-mode/usage-mode.component';
import { HistoryComponent } from './features/history/history.component';
import { WebmasterLoginComponent } from './features/webmaster/pages/webmaster-login/webmaster-login.component';
import { WebmasterDashboardComponent } from './features/webmaster/pages/webmaster-dashboard/webmaster-dashboard.component';
import { LandingComponent } from './features/landing/landing.component';
import { BookDetailComponent } from './features/books/pages/book-detail/book-detail.component';
import { AuthGuard } from './core/guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: 'landing', pathMatch: 'full' },
  { path: 'landing', component: LandingComponent },
  { path: 'libro', component: BookDetailComponent },
  { path: 'libro/:id', component: BookDetailComponent },
  { path: 'login', component: LoginComponent },
  { path: 'webmaster/login', component: WebmasterLoginComponent },
  { path: 'webmaster/dashboard', component: WebmasterDashboardComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'meetings', component: MeetingsPageComponent, canActivate: [AuthGuard] },
  { path: 'meetings/:id', component: MeetingRoomComponent, canActivate: [AuthGuard] },
  { path: 'agenda', component: AgendaComponent, canActivate: [AuthGuard] },
  { path: 'solicitudes', component: JoinRequestsPageComponent, canActivate: [AuthGuard] },
  { path: 'modo-de-uso', component: UsageModeComponent, canActivate: [AuthGuard] },
  { path: 'historial', component: HistoryComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: 'landing' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
