# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
A single person (the owner) tracking their own working time and vacations day to day, on desktop and mobile browsers, often on several devices with one account. A Supabase project can host a few accounts (created by the admin), but each person only sees their own data.

## Product Purpose
Track working time and vacation easily: start/stop timer, manual intervals, daily and weekly summaries, monthly chart, holidays calendar, agenda, Pomodoro, reminders, and company-tenure milestones. Success is effortless, accurate logging of the workday with minimal friction.

## Positioning
Local-first and workday-centric: without an account all data lives in the browser's `localStorage`, with full export/import. Optionally, signing in syncs it across devices through Supabase: the cloud becomes the source of truth and only one device edits at a time (the rest are read-only). Built around the workday (jornada, lunch, rounding, holidays, tenure) rather than projects or billing.

## Operating Context
Used throughout the workday alongside other work, often glanced at via a compact timer. Spanish/Catalan/English speakers; 12h/24h clock preference; light and dark themes.

## Capabilities and Constraints
- Angular 21, standalone components, signals; Tailwind utilities with a global dark-theme rewrite; Kendo UI components.
- No backend of its own: optional Supabase (free plan) for accounts and sync, Vercel (Hobby) for hosting. Every setting must be exportable/importable and sync to the cloud (see CLAUDE.md).
- No sign-up in the app: accounts are created by the project admin.
- Three languages (en, es, ca); every string must exist in all three.

## Evidence on Hand
No testimonials, customers, or benchmarks exist; do not fabricate any.

## Product Principles
1. Logging time must take the fewest possible actions.
2. The data is the user's: never lose it silently, always exportable. When a copy must be replaced or discarded, say so and offer a backup first.
3. Everything clock-related respects the user's language and 12h/24h choice.
4. Calm, glanceable tool: it supports the workday, it does not demand attention.

## Accessibility & Inclusion
No specific standard required; follow good practice (contrast in both themes, keyboard operability, reduced motion).
