# Nais Frontend

Soft Drinks Store – Web Application (SPA)
A single‑page web application built with Angular to display products, manage a shopping cart, and process secure payments through Stripe Checkout. The project follows a modular and scalable architecture, prepared to integrate with a backend using Node.js/Express or Stripe services depending on the final deployment requirements.

# Tech Stack
Frontend: Angular 21, TypeScript, HTML5, CSS3

UI/UX: Reusable components, responsive design, web typography

External Services: Stripe (Checkout, payment sessions)

Architecture: SPA with centralized routing, decoupled services, and typed models

Backend (planned): Node.js + Express (REST API) or Stripe service integration

Deployment: Cloudflare Pages (not deployed)

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

# Cloudflare Pages preparation

Use Cloudflare **Pages** with the Angular project directory (containing
`angular.json` and `package.json`) as the root directory.

- Framework preset: Angular.
- Build command: `ng build`.
- Install command: `npm install` (automatic dependency installation in Pages).
- Development command: `ng serve` (local development).
- Build output directory: `dist/nais_frontend/browser`.
- Node.js: `24.12.0`, pinned in `.node-version`. Remove an older `NODE_VERSION` override or set it to the same version.
- Root directory: leave blank (repository root). `git rev-parse --show-toplevel`
  confirms `angular.json` and `package.json` are at the root of this repository.
  Do not enter the local Windows path or `nais_frontend` as a subdirectory.
- Keep `package-lock.json` committed. No Wrangler dependency or backend is required.
- Leave `SKIP_DEPENDENCY_INSTALL` unset so Pages installs dependencies before running `ng build`. Remove the previously suggested override if it was configured.

Production output verification:

- `package.json` maps `npm run build` to `ng build`; `angular.json` selects the
  `production` configuration by default. Use `ng build` without additional flags.
- The project name is `nais_frontend`, using `@angular/build:application`.
  No `outputPath` override is set. The installed builder resolves its base to
  `dist/nais_frontend` and its browser subdirectory to `browser`.
- On 2026-09-23 the existing generated output was inspected directly:
  `dist/nais_frontend/browser/index.html`, hashed JS/CSS, `fonts/`, `images/`,
  `_redirects`, `_headers`, and `404.html` were all present. The directory is
  verified from actual output, not inferred solely from an Angular convention.
- `tsconfig.app.json` extends the strict root configuration. Its `outDir`
  (`out-tsc/app`) is a TypeScript compilation setting, not the Pages output.
  `tsconfig.spec.json` is for tests and is not the deployment target.

Node compatibility:

- The installed and locked Angular CLI 21.2.20 accepts
  `^20.19.0 || ^22.12.0 || >=24.0.0`.
- The locked optional Linux dependency `@napi-rs/lzma-linux-x64-gnu` has the
  stricter range `^22.20 || ^24.12 || >=25`. Pinning 24.12.0 satisfies all Node
  engine declarations in this lockfile, including Linux packages that are not
  installed on Windows. This replaces the earlier 24.11.0 guidance.
- Pages reads `.node-version`; see its
  [build image documentation](https://developers.cloudflare.com/pages/configuration/build-image/).

Verification limitation: the agent's production build attempt on 2026-09-23
failed with `Cannot read directory "../../..": Access denied`. The existing
output is evidence of the output location, not proof that this latest attempt
succeeded. A successful production build is still required before deployment.

The Angular application preserves these routes:

- `/`: temporary `PrelaunchLanding`.
- `/home`: the original `HomePage`, with its components and styles intact.
- `/products`: existing shop.
- `/products/:slug`: existing shop with the selected product detail.
- `/shop`: existing Angular redirect to `/products`.

`public/_redirects` serves `index.html` for the application routes, including
trailing-slash variants. `/` serves the generated index directly. The `/shop`
rewrite loads Angular so its existing redirect retains query and fragment handling.
The rules do not match `/images/`, `/fonts/`, or generated JavaScript and CSS URLs.

`public/404.html` disables Pages' implicit catch-all SPA fallback so missing
assets and unknown paths receive a real 404. Keep the explicit `_redirects`
rules in sync with future application routes. Angular's existing public asset
configuration copies all three Pages files into the browser output directory.

`public/_headers` adds `X-Content-Type-Options: nosniff` and
`Referrer-Policy: strict-origin-when-cross-origin`, plus `Permissions-Policy: camera=(), microphone=(), geolocation=()` and `X-Frame-Options: SAMEORIGIN`. No restrictive CSP is added. The current application does not use these device APIs; cross-origin embedding of the site is intentionally blocked. These headers do not provide authentication or protect backend APIs.
Never place private credentials in `src/`, `public/`, Angular environment files,
or frontend build substitutions. Everything in the browser output is public.

Local verification:

```sh
npm install
ng build
npm test -- --watch=false
```

Confirm the output contains `index.html`, `_redirects`, `_headers`, `404.html`,
and the image/font assets. After a separately authorized preview deployment,
open and refresh every route above and confirm that existing assets load and
`/images/missing.png` returns 404. This preparation does not deploy the site,
create a Pages project, or change DNS.

References: [Angular on Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-an-angular-site/),
[Pages redirects](https://developers.cloudflare.com/pages/configuration/redirects/),
[Pages serving behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/).
