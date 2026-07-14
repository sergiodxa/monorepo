---
title: Adaptive iOS and macOS Layouts
impact: HIGH
tags: [apple-hig, responsive, ios, macos, layout]
---

# Adaptive iOS and macOS Layouts

Design from the same information architecture, then adapt layout shape to mobile and desktop. Mobile should be focused and linear; desktop can expose persistent navigation, panes, and more simultaneous context.

## Why

- iPhone users need thumb-friendly, focused flows with fewer simultaneous regions
- iPad and Mac users can benefit from persistent navigation and split views
- A single fixed desktop canvas breaks on mobile and wastes desktop capability when over-simplified
- Adaptive layouts feel intentional instead of merely responsive

## Pattern

```tsx
// Bad: fixed desktop layout forced onto every viewport
<div
  mix={css({
    display: "grid",
    width: "1440px",
    gridTemplateColumns: "280px 1fr 360px",
    gap: "2rem",
  })}
>
  <ProjectSidebar />
  <ProjectList />
  <Inspector />
</div>

// Good: focused mobile flow, multi-pane desktop layout
<div
  mix={css({
    display: "grid",
    gap: "1rem",
    padding: "1rem",
    "@media (min-width: 1024px)": {
      gridTemplateColumns: "18rem minmax(0, 1fr)",
      gap: "2rem",
      padding: "2rem",
    },
    "@media (min-width: 1280px)": {
      gridTemplateColumns: "18rem minmax(0, 1fr) 22rem",
    },
  })}
>
  <aside mix={css({ display: "none", "@media (min-width: 1024px)": { display: "block" } })}>
    <ProjectSidebar />
  </aside>
  <main>
    <ProjectList />
  </main>
  <aside mix={css({ display: "none", "@media (min-width: 1280px)": { display: "block" } })}>
    <Inspector />
  </aside>
</div>
```

```tsx
// Good: mobile exposes the inspector as a task, desktop keeps it visible
<button
  popovertarget="project-inspector"
  mix={css({
    minHeight: "2.75rem",
    paddingInline: "1rem",
    borderRadius: "999px",
    "@media (min-width: 1280px)": { display: "none" },
  })}
>
  Details
</button>
<aside
  id="project-inspector"
  popover="auto"
  mix={css({
    width: "min(24rem, calc(100vw - 2rem))",
    "@media (min-width: 1280px)": { display: "block", width: "auto" },
  })}
>
  <Inspector />
</aside>
```

## Device Guidance

| Device class           | Layout guidance                                           |
| ---------------------- | --------------------------------------------------------- |
| iPhone portrait        | One primary column, bottom/top navigation, clear CTA      |
| iPhone landscape       | Preserve focus; avoid cramming desktop sidebars           |
| iPad portrait          | Two-pane layouts can work when content benefits from them |
| iPad landscape and Mac | Persistent sidebar, toolbar, detail pane, inspector       |
| Large desktop          | Increase context, not line length                         |

## Rules

1. Start with a mobile task flow, then add desktop context at larger breakpoints.
2. Do not make desktop-only panes mandatory for completing mobile tasks.
3. Keep primary content visible and central across viewport sizes.
4. Add sidebars, inspectors, and toolbars only when they reduce navigation cost.
5. Use max widths and multi-pane composition to avoid unreadably long lines.
