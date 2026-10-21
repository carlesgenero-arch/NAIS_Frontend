import { ResponsiveImage } from '../../../images/responsive-image.directive';
import { TranslatePipe } from '../../../../i18n/translate.pipe';
import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, linkedSignal } from '@angular/core';
import { CarouselImage } from '../../../../models/carousel-image.interface';

@Component({
  imports: [ResponsiveImage, TranslatePipe],
  selector: 'app-media-carousel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './media-carousel.html',
  styleUrl: './media-carousel.css',
})
export class MediaCarousel {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly images = input<readonly CarouselImage[]>([]);
  readonly label = input<string>('Galeria d’imatges');

  // Índex actiu (per marcar targeta activa o moure scroll)
  protected readonly activeIndex = linkedSignal({
    source: this.images,
    computation: () => 0,
  });

  // Imatge activa (si la vols usar)
  protected readonly currentImage = computed(() => this.images()[this.activeIndex()]);

  // Etiqueta d’accessibilitat (si la vols mantenir)
  protected readonly positionLabel = computed(() =>
    `Imatge ${this.activeIndex() + 1} de ${this.images().length}`
  );

  // Mou el carrusel endavant/enrere
  protected move(direction: number): void {
    const length = this.images().length;
    if (length < 2) return;

    this.activeIndex.update(index => {
      const next = index + direction;
      if (next < 0) return 0;
      if (next >= length) return length - 1;
      return next;
    });

    this.scrollToActiveCard();
  }

  private scrollToActiveCard(): void {
    queueMicrotask(() => {
      const cards = this.element.nativeElement.querySelectorAll('.media-carousel__card');
      const reduceMotion = typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      cards[this.activeIndex()]?.scrollIntoView({
        behavior: reduceMotion ? 'instant' : 'smooth', inline: 'start', block: 'nearest',
      });
    });
  }

  // Navegació amb teclat
  protected onKeydown(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey || this.images().length < 2) return;

    switch (event.key) {
      case 'ArrowLeft': this.move(-1); break;
      case 'ArrowRight': this.move(1); break;
      case 'Home': this.activeIndex.set(0); this.scrollToActiveCard(); break;
      case 'End': this.activeIndex.set(this.images().length - 1); this.scrollToActiveCard(); break;
      default: return;
    }

    event.preventDefault();
  }
}
