import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { CarouselImage } from '../../../../models/carousel-image.interface';

@Component({
  selector: 'app-media-carousel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './media-carousel.html',
  styleUrl: './media-carousel.css',
})
export class MediaCarousel {

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

    // Opcional: scroll automàtic a la targeta activa
    queueMicrotask(() => {
      const track = document.querySelector('.media-carousel__track');
      const cards = track?.querySelectorAll('.media-carousel__card');
      const card = cards?.[this.activeIndex()];
      card?.scrollIntoView({ behavior: 'smooth', inline: 'start' });
    });
  }

  // Navegació amb teclat
  protected onKeydown(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey || this.images().length < 2) return;

    switch (event.key) {
      case 'ArrowLeft': this.move(-1); break;
      case 'ArrowRight': this.move(1); break;
      case 'Home': this.activeIndex.set(0); break;
      case 'End': this.activeIndex.set(this.images().length - 1); break;
      default: return;
    }

    event.preventDefault();
  }
}
