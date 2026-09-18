import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

// Shared Components
import { LogoComponent } from './shared/components/logo/logo.component';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { TopbarComponent } from './shared/components/topbar/topbar.component';
import { NewMeetingModalComponent } from './shared/components/new-meeting-modal/new-meeting-modal.component';
import { HardwareTestModalComponent } from './shared/components/hardware-test-modal/hardware-test-modal.component';

// Feature Components
import { LoginComponent } from './features/auth/pages/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { WelcomeBannerComponent } from './features/dashboard/components/welcome-banner/welcome-banner.component';
import { UpcomingMeetingsComponent } from './features/dashboard/components/upcoming-meetings/upcoming-meetings.component';
import { RecentActivityComponent } from './features/dashboard/components/recent-activity/recent-activity.component';
import { LiveMetricsComponent } from './features/dashboard/components/live-metrics/live-metrics.component';
import { JoinRequestsWidgetComponent } from './features/dashboard/components/join-requests-widget/join-requests-widget.component';
import { SystemStatusWidgetComponent } from './features/dashboard/components/system-status-widget/system-status-widget.component';
import { MeetingFlowTimelineComponent } from './features/dashboard/components/meeting-flow-timeline/meeting-flow-timeline.component';

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
import { OutreachModalComponent } from './features/dashboard/components/outreach-modal/outreach-modal.component';
import { SrcObjectDirective } from './shared/directives/src-object.directive';

@NgModule({
  declarations: [
    AppComponent,
    SrcObjectDirective,
    LogoComponent,
    SidebarComponent,
    TopbarComponent,
    NewMeetingModalComponent,
    HardwareTestModalComponent,
    OutreachModalComponent,
    LoginComponent,
    DashboardComponent,
    WelcomeBannerComponent,
    UpcomingMeetingsComponent,
    RecentActivityComponent,
    LiveMetricsComponent,
    JoinRequestsWidgetComponent,
    SystemStatusWidgetComponent,
    MeetingFlowTimelineComponent,
    MeetingsPageComponent,
    MeetingRoomComponent,
    AgendaComponent,
    JoinRequestsPageComponent,
    UsageModeComponent,
    HistoryComponent,
    WebmasterLoginComponent,
    WebmasterDashboardComponent,
    LandingComponent,
    BookDetailComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
