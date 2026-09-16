import { Component, AfterViewInit } from '@angular/core';

declare const lucide: {
  createIcons: () => void;
};

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css']
})
export class LandingComponent implements AfterViewInit {

  constructor() { }

  ngAfterViewInit(): void {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

}
