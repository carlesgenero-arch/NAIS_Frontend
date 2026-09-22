import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-prelaunch-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prelaunch-landing.html',
  styleUrl: './prelaunch-landing.css',
})
export class PrelaunchLanding {}
