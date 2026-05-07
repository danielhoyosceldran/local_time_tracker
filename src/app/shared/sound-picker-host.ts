import { Component, inject } from '@angular/core';
import { SoundPickerModalComponent } from './sound-picker-modal';
import { SoundPickerService } from './sound-picker.service';
import { SoundId } from './sounds';

@Component({
  selector: 'app-sound-picker-host',
  standalone: true,
  imports: [SoundPickerModalComponent],
  template: `
    @if (svc.request(); as r) {
      <app-sound-picker-modal
        [title]="r.title"
        [current]="r.current()"
        (soundSelected)="onSelect(r.onSelect, $event)"
        (closed)="svc.close()"
      />
    }
  `,
})
export class SoundPickerHostComponent {
  svc = inject(SoundPickerService);

  onSelect(cb: (id: SoundId) => void, id: SoundId): void {
    cb(id);
    this.svc.close();
  }
}
