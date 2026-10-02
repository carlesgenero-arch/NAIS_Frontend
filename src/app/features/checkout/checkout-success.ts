import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

@Component({
  selector: 'app-checkout-success',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './checkout-success.html',
  styleUrl: './checkout-result.css',
})
export class CheckoutSuccess {
  private readonly route = inject(ActivatedRoute);
  /** Untrusted reference only. Its presence never confirms payment. */
  readonly sessionId = toSignal(
    this.route.queryParamMap.pipe(map(params => params.get('session_id'))),
    { initialValue: this.route.snapshot.queryParamMap.get('session_id') },
  );
}
