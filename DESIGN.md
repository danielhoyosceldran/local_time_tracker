---
name: Time Tracker
description: A calm, glanceable local-first workday tracker in slate neutrals with a single indigo accent.
colors:
  indigo-action: "#4f46e5"
  indigo-action-deep: "#4338ca"
  indigo-focus: "#6366f1"
  indigo-focus-dark: "#818cf8"
  indigo-tint: "#eef2ff"
  emerald-ok: "#059669"
  amber-warn: "#f59e0b"
  rose-alert: "#f43f5e"
  red-danger: "#dc2626"
  page-bg: "#f1f5f9"
  surface: "#ffffff"
  surface-muted: "#f8fafc"
  surface-strong: "#e2e8f0"
  text: "#1e293b"
  text-soft: "#475569"
  text-muted: "#64748b"
  text-dim: "#94a3b8"
  border: "#e2e8f0"
  dark-page-bg: "#0a0a0a"
  dark-surface: "#171717"
  dark-surface-muted: "#111111"
  dark-surface-strong: "#262626"
  dark-text: "#e5e5e5"
  dark-text-muted: "#a3a3a3"
  dark-border: "#2a2a2a"
typography:
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 400
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 700
  numeric:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontWeight: 800
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.indigo-action}"
    textColor: "#ffffff"
    rounded: "{rounded.2xl}"
    padding: "16px"
  button-primary-hover:
    backgroundColor: "{colors.indigo-action-deep}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.2xl}"
---

# Design System: Time Tracker

## Overview

**Creative North Star: "The Quiet Timekeeper"**

A tool that sits beside the workday rather than demanding attention. Surfaces are pale slate (light) or near-black neutral (dark), content lives on soft white cards, and a single indigo accent marks the one thing to do next. Numbers carry the personality: durations and clock times are set in a heavy monospace so they read at a glance.

Density is moderate and card-based; the interface is calm enough to leave open all day on desktop and compact enough to use on a phone.

**Key Characteristics:**
- Slate neutrals plus one indigo accent; status hues (emerald, amber, rose/red) appear only for state.
- Rounded, soft-edged cards with gentle ambient shadow.
- Inter for text, JetBrains Mono for time values.
- Dark mode is a neutral-grey rewrite, not an inversion of slate.

## Colors

Restrained palette: cool slate neutrals, one indigo accent, semantic state colors.

### Primary
- **Working Indigo** (#4f46e5): primary actions (start/save), active nav, key links. Deepens to **Pressed Indigo** (#4338ca) on hover. Tinted backgrounds use **Indigo Mist** (#eef2ff) and translucent indigo in dark mode.
- **Focus Indigo** (#6366f1 light, #818cf8 dark): the single keyboard focus ring colour.

### Secondary (state)
- **Clocked-in Emerald** (#059669): running/positive state. **Break Amber** (#f59e0b): lunch/pause. **Alert Rose** (#f43f5e) and **Danger Red** (#dc2626): warnings, destructive actions.

### Neutral
- **Page Slate** (#f1f5f9) page; **Card White** (#ffffff) surfaces; **Soft Slate** (#f8fafc) muted wells; **Rule Slate** (#e2e8f0) borders and strong surfaces.
- Text steps: #1e293b, #475569, #64748b, #94a3b8.
- Dark: page #0a0a0a, surface #171717, strong #262626, border #2a2a2a, text #e5e5e5 / #a3a3a3.

### Named Rules
**The One Accent Rule.** Indigo is the only brand hue; emerald, amber and red communicate state, never decoration.
**The Token Rewrite Rule.** Dark mode works by rewriting standard Tailwind utilities in `src/styles.css`; use standard slate utilities and `--tt-*` tokens, never hard-coded colours.

## Typography

**Body Font:** Inter (ui-sans-serif, system-ui fallback)
**Numeric Font:** JetBrains Mono (ui-monospace fallback)

**Character:** Friendly, neutral sans for labels and copy; heavy mono for clocks and durations so digits align and read instantly.

### Hierarchy
- **Numeric** (mono 800, large): running timer, totals.
- **Label** (Inter 700–900, small, often uppercase/tracked): section and stat labels.
- **Body** (Inter 400, 14–16px): descriptions, lists, settings.

## Layout

Single-page dashboard of stacked and gridded cards on a slate page. Mobile uses a dedicated nav menu; desktop shows the dashboard nav with multiple cards side by side. Spacing follows the Tailwind 4px scale (p-4 / gap-4 typical, py-4 on primary buttons).

## Elevation & Depth

Hybrid: white cards sit on slate with soft ambient shadows (`shadow-sm`, tinted `shadow-slate-200/50`); the primary action carries a faint indigo glow (`shadow-lg shadow-indigo-100`); modals use `shadow-xl` over a `bg-slate-900/40` scrim.

**The Ambient Not Structural Rule.** Shadows are soft and tinted; depth never relies on hard drop shadows or heavy borders.

## Shapes

Soft and rounded: cards and primary buttons `rounded-2xl` (16px), inputs and secondary buttons `rounded-lg` (8px), small controls `rounded-md` (6px), pills and avatars `rounded-full`. Borders are 1px slate.

## Components

### Buttons
- **Shape:** rounded-2xl for hero actions, rounded-lg for secondary.
- **Primary:** Working Indigo fill, white bold text, `py-4 px-4`, indigo ambient shadow.
- **Hover / Focus:** deepens to Pressed Indigo; `active:scale-95`; global 2px indigo focus outline with 2px offset.
- **Secondary:** slate-100 fill, slate text, hover slate-200.
- **Destructive:** red-50 tint with red text, solid red-600/700 on confirm.

### Cards / Containers
- White (#fff, `bg-white/95` variants), 16px radius, 1px slate border, ambient shadow, generous padding.

### Inputs / Fields
- Kendo date/time pickers themed to the neutrals; 8px radius, slate border, indigo focus ring.

### Navigation
- Dashboard nav (desktop) and mobile menu; active item indigo-tinted.

### Timer (signature)
- Large monospace running time on a card with one dominant indigo action; lunch uses amber.

## Do's and Don'ts

### Do:
- **Do** use standard Tailwind slate/indigo utilities so dark mode applies automatically.
- **Do** set clock times via the clock-time helpers and durations in monospace.
- **Do** keep one dominant indigo action per card.
- **Do** keep the global 2px indigo focus ring on every control.

### Don't:
- **Don't** add `outline-none` to controls.
- **Don't** introduce a second brand hue or decorative gradients.
- **Don't** hard-code hex colours in templates; use utilities or `--tt-*` tokens.
- **Don't** use heavy or black drop shadows.
