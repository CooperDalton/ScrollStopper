# Repository Guidelines

## Project Structure & Module Organization
- Source in `src/` using Next.js App Router.
  - Pages and layouts: `src/app/` (server/client components as needed).
  - API routes: `src/app/api/.../route.ts`.
  - UI components: `src/components/` (PascalCase files, `.tsx`).
  - Hooks: `src/hooks/` (`useX` naming, `.ts`/`.tsx`).
  - Shared utils and services: `src/lib/` (`*-server.ts` for server-only).
  - Static assets: `public/`.
- Path alias `@/*` maps to `src/*` (see `tsconfig.json`).

## Build, Test, and Development Commands
- `npm run dev` — start local dev server.
- `npm run dev:turbo` — dev with Turbopack.
- `npm run build` — production build.
- `npm run start` — run built app.
- `npm run lint` — lint TypeScript/React with Next’s config.
- Ad-hoc script example: `node ./test-stroke-width.js` (no formal test runner yet).

## Coding Style & Naming Conventions
- Language: TypeScript, React 19, Next.js 15 (App Router).
- Indentation: 2 spaces; prefer single quotes; include semicolons.
- Components: PascalCase (`SlideshowEditor.tsx`), one default export per component file.
- Functions/vars: camelCase; hooks start with `use`.
- Server-only code in `src/lib/*-server.ts` or API routes; avoid importing server modules into client components.
- Imports use `@/` alias for local modules.
- Linting via ESLint (`eslint.config.mjs`); fix with `npx next lint --fix`.

## Testing Guidelines
- No Jest/Playwright configured. For now:
  - Prefer small, focused utility modules with Node-run scripts for checks.
  - Place quick scripts at repo root or under `scripts/`.
  - Keep functions pure where possible to ease future test adoption.

## Commit & Pull Request Guidelines
- Commits: short, imperative, and scoped (e.g., `editor: fix overlay stacking`).
- PRs must include:
  - Clear description of changes and rationale.
  - Steps to reproduce/test locally (`npm run dev`, pages touched, env vars).
  - Screenshots/GIFs for UI changes.
  - Linked issue or TODO reference if applicable.
  - Lint passes (`npm run lint`); no secrets checked in.

## Security & Configuration Tips
- Use `.env.local` for secrets (Supabase, AI providers); never commit `.env*`.
- Validate all external inputs in API routes; prefer Zod schemas for request/response shapes.
- Keep server credentials and service clients in server-only modules.

---
description: Next.js with TypeScript and Tailwind UI best practices
globs: **/*.tsx, **/*.ts, src/**/*.ts, src/**/*.tsx
---

# Next.js Best Practices

## Project Structure
- Use the App Router directory structure
- Place components in `app` directory for route-specific components
- Place shared components in `components` directory
- Place utilities and helpers in `lib` directory
- Use lowercase with dashes for directories (e.g., `components/auth-wizard`)

## Components
- Use Server Components by default
- Mark client components explicitly with 'use client'
- Wrap client components in Suspense with fallback
- Use dynamic loading for non-critical components
- Implement proper error boundaries
- Place static content and interfaces at file end

## Performance
- Optimize images: Use WebP format, size data, lazy loading
- Minimize use of 'useEffect' and 'setState'
- Favor Server Components (RSC) where possible
- Use dynamic loading for non-critical components
- Implement proper caching strategies

## Data Fetching
- Use Server Components for data fetching when possible
- Implement proper error handling for data fetching
- Use appropriate caching strategies
- Handle loading and error states appropriately

## Routing
- Use the App Router conventions
- Implement proper loading and error states for routes
- Use dynamic routes appropriately
- Handle parallel routes when needed

## Forms and Validation
- Use Zod for form validation
- Implement proper server-side validation
- Handle form errors appropriately
- Show loading states during form submission

## State Management
- Minimize client-side state
- Use React Context sparingly
- Prefer server state when possible
- Implement proper loading states 