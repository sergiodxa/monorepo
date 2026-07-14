---
title: HIG Scope for Web Apps
impact: HIGH
tags: [apple-hig, web, remix-ui, scope, platform]
---

# HIG Scope for Web Apps

Apply Apple's HIG as design guidance for clarity, consistency, feedback, adaptation, and accessibility. Translate native patterns to Remix UI and web primitives instead of recreating OS UI.

## Why

- Web apps run inside browser chrome and should respect browser expectations
- Native-only Apple guidance can create fake or broken UI when copied literally
- The useful part of HIG for web apps is the product behavior: clear hierarchy, focused tasks, adaptive layouts, and high-quality interaction feedback
- Avoiding fake native chrome keeps the UI honest and portable across iOS Safari, iPadOS Safari, desktop Safari, Chrome, and Firefox

## Pattern

```tsx
// Bad: fake iOS home indicator inside the page
<main>
  <Dashboard />
  <div
    mix={css({
      position: "fixed",
      bottom: "0.5rem",
      left: "50%",
      width: "8rem",
      height: "0.25rem",
      borderRadius: "999px",
      backgroundColor: "#000",
      transform: "translateX(-50%)",
    })}
  />
</main>

// Good: respect actual browser safe areas when pinning UI near edges
<main
  mix={css({
    minHeight: "100dvh",
    paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
  })}
>
  <Dashboard />
</main>
```

```tsx
// Bad: expose native-only concepts that do not make sense for a web app
<button>Open in CarPlay</button>
<button>Use macOS menu bar item</button>

// Good: expose browser-available actions
<button type="button">Open full screen</button>
<a href="/reports.csv" download>
  Download CSV
</a>
```

## Web Translation Guide

| HIG idea       | Web-app translation                                      |
| -------------- | -------------------------------------------------------- |
| iOS safe areas | CSS `env(safe-area-inset-*)` for fixed edge UI           |
| Native sheets  | `<dialog>`, popovers, or route-level overlays            |
| Toolbars       | Responsive header, bottom bar, or desktop action toolbar |
| Sidebars       | Desktop persistent navigation; mobile hidden navigation  |
| Dynamic Type   | `rem`, fluid type, user zoom support                     |
| Reduce Motion  | `prefers-reduced-motion` CSS and JS branches             |
| Dark Mode      | `prefers-color-scheme` or app color-scheme toggle        |

## Ignore for Web Apps

- CarPlay, watchOS, tvOS, visionOS, and native-only hardware surfaces
- App Store product page, in-app purchase, native onboarding permission flows, and OS-level settings panes unless the web app directly links to equivalent browser settings
- Native menu bar, Dock, widgets, Share extensions, Live Activities, Shortcuts, and system services that the browser cannot expose
- Pixel-perfect copies of Safari, Finder, Settings, or iOS home screen chrome

## Rules

1. Keep HIG principles; drop native-only implementation details.
2. Use `remix/ui` JSX, semantic HTML, `css()` mixins, and browser APIs.
3. Do not fake OS chrome, hardware affordances, or unavailable platform features.
4. Prefer browser conventions when HIG and web expectations conflict.
5. Test on real mobile and desktop browsers because browser chrome changes available space.
