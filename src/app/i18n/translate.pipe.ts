import { inject, Pipe, type PipeTransform } from '@angular/core';
import { TranslationService, type TranslationParams } from './translation.service';

@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly translations = inject(TranslationService);
  transform(value: string | null | undefined, params?: TranslationParams): string {
    return this.translations.text(value, params);
  }
}
