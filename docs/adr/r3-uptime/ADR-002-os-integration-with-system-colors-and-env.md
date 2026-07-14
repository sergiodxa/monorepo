# ADR-002: OS Integration With CSS System Colors And env()

## Status

**Proposed** - 2026-07-13

## Background

`apps/r3-uptime` styles everything from a hand-rolled `oklch` palette in `resources/theme.ts`, referenced roughly 722 times across 50 files. Dark mode is implemented as per-component `@media (prefers-color-scheme: dark)` overrides. The app declares no `color-scheme`, uses no `env()` variables, has no `viewport-fit=cover`, and ships no PWA manifest.

An investigation evaluated whether the app could delegate colors and spacing to the operating system via [CSS system colors](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/system-color) (`Canvas`, `CanvasText`, `AccentColor`, `Field`, `GrayText`, ...) and [`env()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env) (`safe-area-inset-*`, `titlebar-area-*`, ...), even at the cost of dropping custom colors — but only if the result looks good enough.

## Context

The investigation built a side-by-side prototype replicating representative app UI (stat cards, the monitor table with status badges, all nine button variants, a labeled form field) styled once with the current `theme.ts` tokens and once with system colors, rendered in Chromium on macOS in both light and dark schemes, with every system color's computed value dumped via `getComputedStyle`.

Empirical findings:

- `Canvas`/`CanvasText` resolve to `#ffffff`/`#000000` (light) and `#121212`/`#ffffff` (dark) — nearly indistinguishable from the current `neutral[50]`/`neutral[950]` pair. The system-colors rendering reads as the same app minus the faint hue-145 green tint in the grays.
- `Field`/`FieldText` (`#ffffff`/`#000000` light, `#3b3b3b`/`#ffffff` dark) work well for inputs. `ButtonFace`/`ButtonText` produce an acceptable native-looking secondary button.
- `GrayText` is a fixed `#808080` in both schemes — roughly the same borderline-AA contrast as the current `neutral[500]` on light backgrounds, slightly worse than `neutral[400]` on dark.
- There is no system border gray: `ButtonBorder` computes to pure black (light) / pure white (dark). Usable borders must be derived, e.g. `color-mix(in srgb, CanvasText 15%, transparent)`, which rendered correctly in both schemes.
- `AccentColor`/`AccentColorText` compute to `rgba(0, 0, 0, 0)` — fully transparent — in Chromium. A primary button styled with them disappears from the page entirely. Because Chromium _parses_ the keyword, `@supports (color: AccentColor)` returns true and CSS fallback declarations never apply, so there is no clean progressive enhancement. Only Safari 16.5+ maps `AccentColor` to the user's macOS accent preference; Firefox supports the keyword nominally.
- `LinkText` resolves to the legacy `#0000ee` blue (light) / pale periwinkle (dark) — off-brand.
- The status tones (up/degraded/down) have no system-color equivalent; they carry semantics no system color expresses.
- System colors resolve against the element's used color scheme, so with `color-scheme: light dark` declared they flip with the OS automatically — no media query needed.
- `env()` exposes no OS spacing, radius, or typography tokens. Its useful variables here are `safe-area-inset-*` (which stay `0` unless the viewport meta sets `viewport-fit=cover`); `titlebar-area-*` applies only to installed PWAs using window-controls-overlay, and `keyboard-inset-*` is Chromium-only.
- Without a `color-scheme` declaration, browser-rendered surfaces in dark mode stay light today: scrollbars, `<select>` dropdown menus, date pickers, `<dialog>`/popover backdrops, autofill, and text selection. The app leans heavily on native dialogs and popovers, so this is a live integration gap, independent of any palette decision.
- Chromium is the compatibility floor. Safari maps `Highlight`/`AccentColor` to the actual macOS accent color, so Safari users get more OS integration than the floor guarantees — but the design must hold on Chromium's fixed mappings.

## Decision

Integrate with the OS through `color-scheme`, `accent-color`, and `env()`, and adopt the system-color _vocabulary_ — but not the system-color _values_ — for the app palette:

1. **Declare `color-scheme: light dark`** at the document level (meta tag in `resources/layouts/document.tsx` or CSS on `:root`). This fixes the existing dark-mode gap in scrollbars, select menus, date pickers, dialog backdrops, autofill, and selection, and it is the prerequisite that makes system colors auto-flip with the OS.

2. **Restructure `theme.ts` around the system-color names, backed by custom values.** Using the real system colors was evaluated and rejected: `GrayText` is a fixed `#808080` whose contrast on dark backgrounds regresses below the current `neutral[400]` muted text — an unacceptable accessibility trade-off — and `AccentColor` is unusable until Chromium ships real support (its parse-but-transparent behavior defeats both fallback declarations and `@supports` detection). Instead, the palette is limited to tokens named after the system-color roles — `canvas`/`canvasText` for page surfaces, `field`/`fieldText` for inputs, `buttonFace`/`buttonText`/`buttonBorder` for secondary controls, `grayText` for muted text, `accentColor`/`accentColorText` for primary actions, `linkText` for links — each holding a light/dark pair of custom `oklch` values, the same shape the `status` scale already uses. The pairs are emitted once as `:root` CSS custom properties with a single dark-mode media query (in `document.tsx`'s raw `<style>` tag, alongside the existing `@font-face`), and the exported tokens become `var(--...)` strings, so call sites keep importing from `theme.ts` while per-component dark-mode overrides disappear. Roles the standard vocabulary lacks remain app extensions: `danger` and the `status` tones. Ramp steps with no named role (hover tints, subtle borders) are derived with `color-mix()` from the named tokens rather than kept as numeric steps. The bare CSS keywords (`Canvas`, `AccentColor`, ...) are never emitted directly, so Chromium's broken values can never leak into the rendered UI.

3. **Set the `accent-color` property** (the property, not the `AccentColor` keyword) to the brand green on `:root`, so native checkboxes, radios, `<progress>`, and range inputs render on-brand. Fully supported in all engines.

4. **Adopt safe-area insets**: add `viewport-fit=cover` to the viewport meta and pad fixed-position chrome — the mobile sidebar drawer, toasts, and the docs sidebar — with `env(safe-area-inset-*)` so they clear iPhone notches and the home indicator.

5. **Do not attempt to delegate spacing, radius, or typography to the OS.** No web platform primitive exposes them; `titlebar-area-*` waits until the app ships a PWA manifest with window-controls-overlay, and `keyboard-inset-*` is skipped as single-engine.

## Consequences

### Positive

- Native browser chrome (scrollbars, pickers, backdrops, autofill, selection) finally matches the app's dark mode.
- The palette is constrained to a small set of named roles from a standardized, documented vocabulary instead of a ten-step numeric ramp, while keeping the hue-145 green tint and full contrast control in both schemes.
- Light/dark values live in one `:root` block, so the per-component `@media (prefers-color-scheme: dark)` duplication across ~50 files becomes deletable.
- In forced-colors / Windows High Contrast mode the browser substitutes the real system colors for the same roles, so the design degrades coherently by construction.
- Native form controls pick up the brand color via `accent-color` at zero per-component cost.
- Fixed mobile chrome stops colliding with iOS safe areas.
- If Chromium ships real `AccentColor` support, adopting it is a one-variable change.

### Negative

- Roughly 722 palette references across 50 files must be re-mapped from numeric steps to named roles; intermediate steps with no obvious role (e.g. `neutral[700]` secondary text, 68 uses) need per-call-site judgment or `color-mix()` derivations.
- Declaring `color-scheme` changes how unstyled native surfaces render in dark mode (scrollbars, backdrops, select menus), so a one-time visual QA pass is needed.

### Neutral

- System-color _values_ were evaluated and rejected for app surfaces; only the _names_ are adopted. The values decision can be revisited if system palettes gain reliable contrast guarantees.
- `danger` and the `status` tones remain app-specific extensions to the vocabulary, since no system color carries their semantics.
- Mona Sans stays; `system-ui` remains its fallback rather than becoming the first choice.

## References

- [MDN: CSS system colors](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/system-color)
- [MDN: env()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env)
- [MDN: color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme)
- [MDN: accent-color](https://developer.mozilla.org/en-US/docs/Web/CSS/accent-color)
- `apps/r3-uptime/resources/theme.ts` — the palette that remains the single source of color
- [ADR-013: Remix UI For Application Interfaces](../ADR-013-remix-ui-for-application-interfaces.md)
