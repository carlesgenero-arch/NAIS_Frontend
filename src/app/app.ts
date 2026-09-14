import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './core/shared/base/header/header';
import { Footer } from './core/shared/base/footer/footer';

@Component({
  selector: 'app-root',
  imports: [Header, RouterOutlet, Footer],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
