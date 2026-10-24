# ADR-175: Vitest Browser Mode for Tests That Need a DOM

## Status

**Accepted** - 2026-10-24

## Background

Twenty-seven test files ran under `// @vitest-environment happy-dom`. happy-dom simulates a
document in Node, and the simulation leaked into the tests: six files stubbed
`CSSStyleSheet.prototype.insertRule` because happy-dom rejects the nested rules and cascade
layers `remix/component` mixins write, and others relied on behavior no browser has (deleting
`navigator.serviceWorker`, a link click that never navigates). A test passing there proved the
component worked in happy-dom, not in a visitor's browser. The user corrected the approach:
DOM tests run in Vitest Browser Mode.

## Decision

1. **A test that needs a DOM is a `*.browser.test.ts(x)` file** and runs in headless Chromium
   through Vitest Browser Mode with the `@vitest/browser-playwright` provider, pinned to the
   Vitest version `vite-plus` bundles. The suffix mirrors `*.workers.test.ts`: the file name
   says which runtime executes it.
2. **`browserProject()` in the root `vite.config.ts`** builds one `<name>-browser` project per
   workspace holding such files, sharing the workspace's plugins and aliases with its threads
   project. Every threads project excludes `*.browser.test.ts(x)`.
3. **MSW runs as a service worker** in browser tests: `setupWorker` from `msw/browser`, with
   `mockServiceWorker.js` served from `test/browser-public/` as every browser project's
   `publicDir`.
4. **A browser test mounts what it checks.** `render()` from `remix/component/test` puts the
   component in the page, so a test asserts computed styles and layout rather than parsing
   `renderToString` output into a `<template>`. Server rendering stays for tests about server
   output itself or about hydrating it with `run()`, the path islands and frames take in
   production. A component that loads a third-party `<iframe>` mounts into a detached container,
   which keeps its attributes and loads nothing.
5. **Server-only code stays out of browser tests.** A test that renders the whole app and only
   reads the markup is a threads test that parses with `@sdxc/html/document`.
6. **CI installs Chromium only for a workspace holding a browser test**, caching the headless
   shell per Playwright version.
7. **`happy-dom` is removed**, and `.config/sdxc/checks/` fails on any test that asks for a
   simulated DOM environment.

## Consequences

- Workarounds for the simulated DOM are gone; a component's styles and platform APIs behave as
  they do in production, so a failure points at the component.
- Browser tests start a Chromium page per project, adding a few seconds to a run, and a local
  run needs `bunx playwright install chromium` once.
- `@acemir/cssom`'s `browser` field names a build without exports; browser projects alias it to
  its CommonJS entry so modules that reach `linkedom` still load.
- `sdxc ui` ships a component's `.browser.test.tsx` like any other test; an app copying one
  needs Browser Mode configured to run it.
