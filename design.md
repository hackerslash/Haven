# Design — Haven

A locked design system for this app. Every page redesign reads this file before emitting code. Do not regenerate per page — extend or amend this file when the system needs to grow.

## Genre
playful (with luxury typography)

## Macrostructure family
- App pages:       Workbench (Sidebar + content area, rounded panels, soft shadows)
- Onboarding:      Centered Soft-Modal (Focused, distraction-free entry)

## Theme
Custom vibe: "luxury soft, relieved, GenZ connection"
Axes: light / italic-serif / cool (lavender)

### Light Mode
- `--color-paper`:      oklch(97% 0.015 290)
- `--color-paper-2`:    oklch(94% 0.018 290)
- `--color-ink`:        oklch(22% 0.012 290)
- `--color-ink-2`:      oklch(45% 0.012 290)
- `--color-rule`:       oklch(88% 0.015 290)
- `--color-accent`:     oklch(70% 0.12 290)
- `--color-accent-ink`: oklch(22% 0.012 290)
- `--color-focus`:      oklch(68% 0.15 290)

### Dark Mode
- `--color-paper`:      oklch(18% 0.015 290)
- `--color-paper-2`:    oklch(22% 0.018 290)
- `--color-ink`:        oklch(95% 0.010 290)
- `--color-ink-2`:      oklch(75% 0.010 290)
- `--color-rule`:       oklch(28% 0.015 290)
- `--color-accent`:     oklch(75% 0.12 290)
- `--color-accent-ink`: oklch(18% 0.015 290)
- `--color-focus`:      oklch(70% 0.15 290)

## Typography
- Display: "Fraunces", weight 400, style italic (for emotional/hero text)
- Body:    "Inter Variable", weight 400
- Display tracking: -0.02em
- Type scale anchor: `--text-lg` = clamp(1.125rem, 2vw, 1.375rem)

## Spacing
4-point named scale.
- `--space-xs`: 0.25rem
- `--space-sm`: 0.5rem
- `--space-md`: 1rem
- `--space-lg`: 1.5rem
- `--space-xl`: 2rem
- `--space-2xl`: 3rem

## Motion
- Easings: `cubic-bezier(0.25, 1, 0.5, 1)` named `--ease-out-quart`
- Reveal pattern: Soft fade + slight translateY(-4px)
- Hover lift: Cards and buttons lift slightly (`translateY(-1px)`) with expanded soft shadow.

## Microinteractions stance
- Hover delay: 0ms
- Focus: Immediate ring
- Success: Soft, relieving fade (not loud or celebratory).
- Corners: `--radius-lg` (16px) for main panels, `--radius-md` (12px) for cards, `--radius-full` for pills/avatars.

## CTA voice
- Primary CTA: Solid accent fill, fully rounded (`rounded-full`), soft drop shadow, bold Inter.
- Secondary CTA: Transparent background, ink-2 text, hover to paper-2 background.

## What pages MUST share
- The Fraunces display font for main headings.
- The accent lavender colour and its restrained placement (≤ 5% per viewport).
- Soft panel borders and drop shadows (`--shadow-soft: 0 8px 24px -10px oklch(70% 0.12 290 / 0.15)`).
- The CTA voice (button shape, border-radius).

## What pages MAY differ on
- Specific layouts within the Workbench family (e.g., chat vs. call view).
