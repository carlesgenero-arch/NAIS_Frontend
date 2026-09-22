import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-newsletter',
  imports: [ReactiveFormsModule],
  templateUrl: './newsletter.html',
  styleUrl: './newsletter.css',
})
export class Newsletter {
  private readonly fb = inject(FormBuilder);

  protected readonly newsletterForm = this.fb.group({
    email: [
      '',
      [
        Validators.required,
        Validators.email,
        Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/),
      ],
    ],
  });

  onSubmit() {
    if (this.newsletterForm.invalid) {
      console.error('Email no vàlid');
      return;
    }

    const email = this.newsletterForm.value.email;
    console.log('Email correcte:', email);

    // Aquí pots integrar Web3Forms, backend, SweetAlert2, etc.
  }


}
