# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
A single person (the owner) tracking their own working time and vacations day to day, on desktop and mobile browsers. Multi-user accounts are a possible future, not a current audience.

## Product Purpose
Track working time and vacation easily: start/stop timer, manual intervals, daily and weekly summaries, monthly chart, holidays calendar, agenda, Pomodoro, reminders, and company-tenure milestones. Success is effortless, accurate logging of the workday with minimal friction.

## Positioning
Local-first and workday-centric: all data lives in the browser's `localStorage` with no backend, plus optional private gist sync and full export/import. Built around the workday (jornada, lunch, rounding, holidays, tenure) rather than projects or billing.

## Operating Context
Used throughout the workday alongside other work, often glanced at via a compact timer. Spanish/Catalan/English speakers; 12h/24h clock preference; light and dark themes.

## Capabilities and Constraints
- Angular 21, standalone components, signals; Tailwind utilities with a global dark-theme rewrite; Kendo UI components.
- No backend; every setting must be exportable/importable (see CLAUDE.md).
- Three languages (en, es, ca); every string must exist in all three.
- Future, undecided: user accounts and cloud-based data storage ("maybe").

## Evidence on Hand
No testimonials, customers, or benchmarks exist; do not fabricate any.

## Product Principles
1. Logging time must take the fewest possible actions.
2. Local data is the user's: never lose it, always exportable.
3. Everything clock-related respects the user's language and 12h/24h choice.
4. Calm, glanceable tool: it supports the workday, it does not demand attention.

## Accessibility & Inclusion
No specific standard required; follow good practice (contrast in both themes, keyboard operability, reduced motion).
