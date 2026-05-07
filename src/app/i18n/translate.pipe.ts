import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslationService } from './translation.service';
import type { TranslationKey } from './translations/en';

@Pipe({
  name: 't',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private svc = inject(TranslationService);
  transform(key: TranslationKey | string, params?: Record<string, string | number>): string {
    return this.svc.t(key as TranslationKey, params);
  }
}
