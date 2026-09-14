import { TestBed } from '@angular/core/testing';
import { Modal } from './modal';

describe('Modal', () => {
  it('opens natively and restores focus to the trigger after closing', async () => {
    await TestBed.configureTestingModule({ imports: [Modal] }).compileComponents();
    const fixture = TestBed.createComponent(Modal);
    fixture.componentRef.setInput('title', 'Test product');
    await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    const showModal = vi.fn(() => dialog.setAttribute('open', ''));
    const close = vi.fn(() => {
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
    });
    Object.defineProperty(dialog, 'showModal', { value: showModal });
    Object.defineProperty(dialog, 'close', { value: close });
    try {
      fixture.componentInstance.open();
      expect(showModal).toHaveBeenCalledOnce();
      expect(dialog.getAttribute('aria-label')).toBe('Test product');
      const button = dialog.querySelector('button')!;
      button.focus();
      button.click();
      expect(close).toHaveBeenCalledOnce();
      expect(document.activeElement).toBe(trigger);
    } finally {
      trigger.remove();
    }
  });
});
