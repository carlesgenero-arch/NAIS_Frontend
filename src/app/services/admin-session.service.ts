import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
@Injectable({ providedIn: 'root' })
export class AdminSessionService {
  private readonly http = inject(HttpClient);
  check() {
    return this.http.get<unknown>('/api/admin/session').pipe(map(value => {
      if (!value || typeof value !== 'object' || !('role' in value) || value.role !== 'admin') {
        throw new Error('Admin session unavailable');
      }
      return { role: 'admin' as const };
    }));
  }
}
