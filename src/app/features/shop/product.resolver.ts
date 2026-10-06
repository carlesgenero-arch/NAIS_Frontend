import { inject } from '@angular/core';
import { RedirectCommand, ResolveFn, Router } from '@angular/router';

/** Fetching belongs to the page so a direct navigation can display loading/error states. */
export const productResolver: ResolveFn<boolean> = route => {
  const slug = route.paramMap.get('slug');
  return slug && slug.length <= 200 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    ? true : new RedirectCommand(inject(Router).parseUrl('/products'));
};
