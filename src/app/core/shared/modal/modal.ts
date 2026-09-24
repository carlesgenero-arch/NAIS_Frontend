import { ChangeDetectionStrategy, Component, ElementRef, input, viewChild } from '@angular/core';

@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class Modal {
  readonly title = input.required<string>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private trigger: HTMLElement | null = null;

  open(): void {
    const dialog = this.dialog().nativeElement;
    if (dialog.open) return;
    const activeElement = dialog.ownerDocument.activeElement;
    this.trigger = activeElement instanceof HTMLElement ? activeElement : null;
    dialog.showModal();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  protected restoreFocus(): void {
    if (this.trigger?.isConnected) this.trigger.focus();
    this.trigger = null;
  }
}
