# NAIS — Coding Agent Instructions

This repository contains the frontend for NAIS, a soft drinks e-commerce application built with Angular 21. This file defines the rules that every coding agent must follow when working on the project.

## Current Goal

Build the frontend incrementally, keeping every change small, functional, and easy to review. Follow this implementation order:

1. Header and navigation.
2. Home page hero.
3. Product grid and product cards.
4. Offer section.
5. Newsletter.
6. Product catalogue and product details.
7. Shopping cart.
8. Checkout and Stripe integration.

Do not implement later phases unless the task explicitly requests them.

## Stack and Commands

* Angular 21 with standalone components.
* Angular 21 components are standalone by default. Do not add `standalone: true` to new component decorators unless the project configuration explicitly requires it.
* TypeScript 5.9 in strict mode.
* Native HTML and CSS.
* Package manager: npm.
* Development server: `npm start`.
* Build: `npm run build`.
* Tests: `npm test`.

Do not add new libraries or frameworks without first explaining why they are necessary.

## Architecture

* `src/app/core/`: global elements or elements that exist only once in the application.
* `src/app/core/shared/`: reusable presentational components without business logic.
* `src/app/features/`: business features and application sections.
* `src/app/models/`: shared interfaces and types.
* `src/app/services/`: shared state and business logic.
* `src/app/app.routes.ts`: centralised route definitions.

Keep components small and focused on a single responsibility. Before creating a new component, check whether an equivalent reusable component already exists.

## Angular and TypeScript Rules

* Use standalone components; do not create `NgModule` classes.
* Use Angular’s modern control-flow syntax (`@if`, `@for`) when needed.
* Type inputs, outputs, models, return values, and state; avoid `any`.
* Use `input()` and `output()` for communication between components when appropriate for the existing code.
* Use signals for simple local or shared state.
* Keep business logic out of HTML templates.
* Do not duplicate the `Product` interface; reuse `src/app/models/product.interface.ts`.
* Name services with the `Service` suffix, such as `ProductService` and `CartService`, to avoid confusing them with models or components.
* Lazy-load routed pages when they are created.
* Preserve the strict TypeScript and Angular configuration.

## Styles and Design

* The existing styles in `src/styles.css` and the component CSS files are the project’s visual source of truth.
* Preserve the existing colours, typography, spacing, and visual decisions. Do not infer or replace values from Penpot when they conflict with the CSS.
* Reuse global CSS custom properties before adding literal values.
* If a new design token is required, define it in `:root` and justify it in the change summary.
* Write mobile-first styles and add only the breakpoints that are needed.
* Avoid inline styles and `!important`.
* Maintain accessibility: semantic HTML, image alternative text, form labels, visible focus states, and keyboard navigation.
* Do not change the design or global tokens unless the task requires it.

## Data, Services, and Backend

* During the mock-up phase, centralise mock data in the product service instead of duplicating it across components.
* Manage the cart through the cart service and expose derived state such as total quantity and subtotal.
* Presentational components must not call Stripe directly.
* Stripe secret keys, Checkout Session creation, and webhooks belong in the backend and must never appear in the frontend.
* Do not assume that a Node.js/Express backend already exists; the backend architecture is still pending.

## Quality and Verification

For every change:

1. Read the related files before editing them.
2. Make the smallest change that completes the task.
3. Add or update tests when introducing behaviour.
4. Run at least `npm run build`.
5. Run the relevant tests whenever possible.
6. Check for console errors and responsive regressions.

Do not claim that a feature is implemented when only an empty component or placeholder exists.

## Collaboration with Carles

Carles is developing his first professional project as a junior developer. Explain changes clearly and briefly, including:

* what was changed;
* why it was implemented that way;
* which files were affected;
* how to verify the result;
* the next logical step.

Avoid making large changes without splitting them into reviewable tasks. Do not rewrite complete files when a small edit is sufficient.
