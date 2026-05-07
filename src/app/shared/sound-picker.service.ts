import { Injectable, Signal, signal } from '@angular/core';
import { SoundId } from './sounds';

interface SoundPickerRequest {
  title: string;
  current: Signal<SoundId>;
  onSelect: (id: SoundId) => void;
}

@Injectable({ providedIn: 'root' })
export class SoundPickerService {
  private readonly _request = signal<SoundPickerRequest | null>(null);
  readonly request = this._request.asReadonly();

  open(req: SoundPickerRequest): void {
    this._request.set(req);
  }

  close(): void {
    this._request.set(null);
  }
}
