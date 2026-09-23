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
      │    ├── newsletter/
      │    └── offer/
      ├── features/shop/
      │    ├── shop-page/
      │    ├── product-grid/
      │    └── product-shop-card/
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
Shop catalogue: reusable product grid and shop cards. Other features: cart, newsletter, offers.

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

# Vercel deployment

Use the Angular project directory (the folder containing `angular.json`) as the
Vercel Root Directory. `vercel.json` sets:

- Framework: Angular.
- Install command: `npm ci` (keep `package-lock.json` committed).
- Production build: `npm run build -- --configuration production`.
- Output directory: `dist/nais_frontend/browser`, including `index.html` and public assets.

The root `/` serves `index.html`. Explicit SPA rewrites support direct links and
refreshes for `/home`, `/products`, `/products/:slug`, and the legacy `/shop`
route. Asset URLs such as `/images/...`, `/fonts/...`, and generated JavaScript
and CSS files are not matched by these rewrites. When adding an Angular route,
add its corresponding Vercel rewrite if it needs direct access.

Only `X-Content-Type-Options: nosniff` and
`Referrer-Policy: strict-origin-when-cross-origin` are added. No CSP is imposed.
Do not place private credentials in `src/`, `public/`, Angular environment files,
or frontend build substitutions: browser output is public. Backend credentials
must remain in a separate server environment. Local `.env` files and `.vercel/`
are ignored by Git.

Before publishing, run the production build and `npm audit`, review the audit
findings, and check a Vercel preview: open and refresh `/`, `/home`, `/products`,
and `/products/orange-spritz`. Confirm that fonts and images load and that a
missing `/images/missing.png` returns 404 rather than the SPA HTML.
