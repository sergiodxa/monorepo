# ADR-188: Deterministic Browser Tests

## Status

**Implemented** - 2026-11-02

## Background

Browser tests passed on a developer's Mac and failed on CI's Ubuntu runner: 17 tests across
`@sdxc/ui`, sdxc-site and reader, red on `main` for ten runs. Two separate parts of the test
environment depended on the machine running it, and neither showed up locally.

## Context

### Fonts

Most components inherit the page's font, and themes set `--ui-font-*` to system stacks
(`ui-sans-serif, system-ui, …`). A test therefore laid text out in whatever the operating
system ships: Times or San Francisco on macOS, DejaVu on Linux. DejaVu Sans sets a sentence
about 9% wider, so footers and labels wrapped to another line on CI. That broke every assertion
that holds a placeholder to its content's height, and every test that needs text to wrap at a
given width.

### Touch emulation

Tests that need `(hover: none)` turned on CDP touch emulation and turned it off again in
`afterEach`. Playwright launches headless Chromium with a fine, hovering pointer. When touch
emulation is switched off, Chromium on Linux falls back to the input devices the machine has,
which on a CI runner is none. From that point on the page matches `(hover: none)` and
`(pointer: none)`, and so does every later test file Vitest runs in the same page. No CDP
command restores the launch-time pointer: `Emulation.setEmulatedMedia` does not emulate
`hover` or `pointer`. On macOS the trackpad is a real device, so the reset looked correct
there.

## Decision

1. **Every browser project loads `test/browser-font.ts`.** It sets the root face to Arial and
   pins each `--ui-font-sans`, `--ui-font-display`, `--ui-font-serif` and `--ui-font-mono` on
   every element, with `!important`, to Arial, Times New Roman and Courier New. Linux resolves
   those names to Liberation Sans, Serif and Mono, which have the same glyph widths, so text
   wraps to the same lines on both systems. The rules sit in a stylesheet in `<head>`, so a
   test that clears inline styles on `<html>` keeps them.
2. **A test that needs a touch screen lives in a `*.touch.browser.test.ts(x)` file.**
   `browserProject()` gives each workspace a second Chromium instance, `<name>-touch`, whose
   Playwright context is created with `hasTouch: true`. That page matches `(hover: none)` and
   `(pointer: coarse)` from its first test to its last, and the main instance skips those
   files. Tests never toggle `Emulation.setTouchEmulationEnabled`.
3. **Placeholders mirror the typography of what they stand in for.** A placeholder bar for a
   monospace value is set in the monospace face, and one for a value with its own baseline
   (an initials chip beside a name) takes the same shape. The placeholder then holds its
   content's height in any font, not only in the one that tests run.

## Consequences

### Positive

- A browser test gives the same result on macOS and on CI, so a green local run means a green
  CI run.
- Pinning fonts exposed font-dependent layout bugs that any visitor without the Mac system
  font would also have hit: the docs hub's start cards stacked one per row under the prose
  measure, and Pulse's details placeholder was shorter than its monospace values.

### Negative

- Tests measure layout in Arial, not in a theme's own stack. A wrap that only happens in San
  Francisco or DejaVu goes untested.
- Shared fixtures for a component tested on both pointers live in a module under `src/test/`,
  which the release build publishes like any other module there.

### Neutral

- A workspace with no touch tests still gets a `<name>-touch` project, which collects nothing.

## Alternatives Considered

- **Run browser tests on macOS runners.** CI would match a developer's Mac exactly and free
  minutes cover a public repository. Rejected because the results would still depend on the
  machine, and CI would stop catching Linux-only layout problems.
- **Reset touch emulation more thoroughly.** Every CDP reset was tried (`setEmulatedMedia`,
  `setEmitTouchEventsForMouse`, re-disabling touch); none restored a fine pointer on Linux.
