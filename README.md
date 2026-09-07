# Nais Frontend

Soft Drinks Store – Web Application (SPA)
A single‑page web application built with Angular to display products, manage a shopping cart, and process secure payments through Stripe Checkout. The project follows a modular and scalable architecture, prepared to integrate with a backend using Node.js/Express or Stripe services depending on the final deployment requirements.

# Tech Stack
Frontend: Angular 21, TypeScript, HTML5, CSS3

UI/UX: Reusable components, responsive design, web typography

External Services: Stripe (Checkout, payment sessions)

Architecture: SPA with centralized routing, decoupled services, and typed models

Backend (planned): Node.js + Express (REST API) or Stripe service integration

Deployment: Vercel

# Project Architecture

src/
 └── app/
      ├── core/
      │    └── shared/base/
      │         ├── header/
      │         ├── navbar/
      │         └── page/
      ├── features/components/
      │    ├── cart/
      │    ├── product-grid/
      │    ├── product-store/
      │    ├── newsletter/
      │    └── offer/
      ├── models/
      │    └── product.interface.ts
      ├── services/
      │    ├── cart.service.ts
      │    └── product.service.ts
      ├── app.routes.ts
      ├── app.config.ts
      ├── app.css
      └── app.html

✔ Core / Shared
Global layout: header, navbar, base page structure.

✔ Features
Functional components: product grid, product store, cart, newsletter, offers.

✔ Services
Business logic: product management, cart operations, Stripe integration.

✔ Models
Typed interfaces to ensure data consistency across the application.


# Main Features

Product catalog with grid layout

Shopping cart (add, remove, update items)

Smooth navigation without page reloads (SPA)

Secure checkout using Stripe

Modular architecture ready for backend expansion

Responsive UI with reusable components


# Installation and setup

# Clone the repository
git clone https://github.com/carlesgenero-arch/NAIS_Frontend

# Install dependencies
npm install

# Run development server
ng serve


# Backend (planned architecture)

Option A — Node.js + Express + MySQL

    REST API

    Product management

    Order creation

    Stripe webhooks

Option B — Stripe as main service

    Checkout sessions

    Order management via Stripe Dashboard

    Webhooks for synchronization

    Both approaches are supported by the current frontend structure.

# Project Status

The project is active and under development, with the frontend functional and Stripe integration implemented.
Backend architecture is being defined to choose the most suitable approach for deployment.


# Author

Carles Generó
Full Stack Developer 
GitHub: https://github.com/carlesgenero-arch
LinkedIn: https://www.linkedin.com/in/carles-genero/