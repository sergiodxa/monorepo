# packages/ui AGENTS

## Purpose

Guidance for implementing and updating UI components and stories in `packages/ui`.

## Core Principles

- Use React Aria Components (RAC) whenever possible; do not add Radix or other UI bases.
- If a shadcn component uses a specific library (e.g., Sonner), use that library only if already in the repo and keep integration minimal.
- Keep components accessible: keyboard support, proper focus-visible styling, ARIA semantics, and disabled/invalid states.
- Keep components composable: export subcomponents, allow className overrides, use data attributes for styling.
- Use the theme system consistently: `primary | neutral | success | warning | danger` color tokens.
- Use `ui-*` utility classes and `data-*` attributes for styling.
- Prefer `data-focus-visible` for focus outlines, not focus/active clicks.
- Keep story examples minimal and use-case focused; one main customizable story with controls plus composition examples.

## CSS & Styling Rules

- All component styling lives in `packages/ui/src/styles.css` using Tailwind v4 `@utility` blocks.
- Avoid story-only styling that compensates for missing component styles.
- Links/NavLinks are always underlined for accessibility.
- Use consistent control sizing (baseline ~40px) unless component-specific.
- Add hover/pressed/focus-visible/disabled/invalid states where relevant.

## Recent Corrections to Preserve

- Storybook imports UI styles using `@import` (not `@source`).
- Alert uses `color` prop (not `variant`), supports `primary | success | warning | danger | neutral`.
- Switch supports pressed styles via `data-pressed` on track and thumb.
- Tabs include animated indicator via CSS variables and ResizeObserver; use AbortController for window listeners.
- Overlay arrows are absolutely positioned and handle `data-placement` with prefix selectors.
- Group outline only shows on focus-visible.

## Storybook Requirements

- Each story should render a single instance so controls work.
- Use a single highly customizable Default story; add separate composition stories only when needed.
- Avoid custom classes in stories unless they demonstrate composition (not to patch missing styles).

## Implementation Workflow

- Create component files in `packages/ui/src/components/`.
- Add styles to `packages/ui/src/styles.css` using `@utility`.
- Add stories in `packages/ui/src/components/*.stories.tsx` following existing patterns.
- Ensure components and stories use `ui-*` classes and data attributes.

## Tooling

- Do not install Radix/Base UI.
- Use RAC components and hooks; for custom interactions, consider the Command Invoker API if applicable.
