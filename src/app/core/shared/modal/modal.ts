import { ChangeDetectionStrategy, Component, ElementRef, input, OnDestroy, output, signal, viewChild } from '@angular/core';

@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class Modal implements OnDestroy {
  readonly title = input.required<string>();
  readonly titleCount = input<number>();
  readonly variant = input<'dialog' | 'drawer' | 'promotion'>('dialog');
  readonly closed = output<void>();
  private readonly opened = signal(false);
  readonly isOpen = this.opened.asReadonly();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private trigger: HTMLElement | null = null;
  private lockedRoot: HTMLElement | null = null;

  open(): void {
    const dialog = this.dialog().nativeElement;
    if (dialog.open) return;
    const activeElement = dialog.ownerDocument.activeElement;
    this.trigger = activeElement instanceof HTMLElement ? activeElement : null;
    dialog.showModal();
    this.focusClose();
    this.opened.set(true);
    if (this.variant() !== 'dialog') {
      const root = dialog.ownerDocument.documentElement;
      if (!root.classList.contains('nais-drawer-open')) {
        root.classList.add('nais-drawer-open');
        this.lockedRoot = root;
      }
    }
  }

  focusClose(): void {
    this.dialog().nativeElement.querySelector<HTMLButtonElement>('.modal-close')?.focus({ preventScroll: true });
  }

  protected close(): void {
    this.dialog().nativeElement.close();
    this.restoreFocus();
  }

  protected cancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  protected closeOnBackdrop(event: MouseEvent): void {
    const dialog = this.dialog().nativeElement;
    if (this.variant() === 'dialog' || event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom) this.close();
  }

  protected restoreFocus(): void {
    const wasOpen = this.opened();
    this.opened.set(false);
    this.lockedRoot?.classList.remove('nais-drawer-open');
    this.lockedRoot = null;
    if (this.trigger?.isConnected) this.trigger.focus({ preventScroll: true });
    this.trigger = null;
    if (wasOpen) this.closed.emit();
  }

  protected handleNativeClose(): void {
    // Native close events are queued: a previous close must not reset a reopened dialog.
    if (!this.dialog().nativeElement.open) this.restoreFocus();
  }

  ngOnDestroy(): void {
    this.restoreFocus();
  }
}
