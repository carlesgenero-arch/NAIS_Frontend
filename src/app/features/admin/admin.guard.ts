import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AdminSessionService } from '../../services/admin-session.service';
/** Navigation UX only: every admin API independently authenticates on the server. */
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AdminSessionService).check().pipe(
    map(() => true),
    catchError(() => of(router.createUrlTree(['/admin/login']))),
  );
};
