import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';

@Directive({
  selector: 'video[appSrcObject]'
})
export class SrcObjectDirective implements OnChanges {
  @Input() appSrcObject: MediaStream | null = null;

  constructor(private el: ElementRef<HTMLVideoElement>) {}

  ngOnChanges(changes: SimpleChanges): void {
    const videoElem = this.el.nativeElement;
    if (changes['appSrcObject']) {
      videoElem.srcObject = this.appSrcObject;
      if (this.appSrcObject) {
        videoElem.play().catch(err => console.warn('Video auto-play suppressed:', err));
      }
    }
  }
}