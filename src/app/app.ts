import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './core/shared/base/header/header';
import { Hero } from './core/shared/page/hero/hero';

@Component({
  selector: 'app-root',
  imports: [Header, Hero, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('nais_frontend');
}
