---
title: Gestures Need Visible Alternatives
impact: HIGH
tags: [apple-hig, gestures, touch, hover, keyboard]
---

# Gestures Need Visible Alternatives

Use gestures, hover affordances, and keyboard shortcuts as accelerators. Every important task needs a visible, reachable, and accessible control.

## Why

- Browser gesture support varies across iOS, iPadOS, macOS, and other platforms
- Users may not discover hidden swipe, drag, long-press, hover, or shortcut-only actions
- Some gestures conflict with browser navigation, scrolling, text selection, or assistive technology
- Visible alternatives make expert accelerators safe instead of mandatory

## Pattern

```tsx
// Bad: deleting is only implied by a hidden custom swipe behavior
<article data-swipe-action="delete">
  <ProjectSummary />
</article>

// Good: swipe can exist, but the visible button is the reliable path
<article
  mix={css({
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "1rem",
    border: "1px solid var(--color-border)",
    borderRadius: "0.75rem",
  })}
>
  <ProjectSummary />
  <button
    type="button"
    mix={css({ marginLeft: "auto", minHeight: "2.75rem", paddingInline: "1rem", borderRadius: "999px" })}
  >
    Delete
  </button>
</article>
```

```tsx
// Bad: hover is the only way to reveal actions
<li mix={css({ "& button": { display: "none" }, "&:hover button": { display: "inline-flex" } })}>
  <span>Quarterly report</span>
  <button>Share</button>
</li>

// Good: actions remain keyboard and touch reachable
<li mix={css({ display: "flex", alignItems: "center", gap: "0.75rem", paddingBlock: "0.5rem" })}>
  <span mix={css({ flex: 1 })}>Quarterly report</span>
  <button
    mix={css({
      minHeight: "2.75rem",
      paddingInline: "1rem",
      borderRadius: "999px",
      "@media (min-width: 640px)": { minHeight: "2.25rem" },
    })}
  >
    Share
  </button>
</li>
```

## Gesture Guidance

| Gesture or shortcut | Web-app requirement                                      |
| ------------------- | -------------------------------------------------------- |
| Swipe actions       | Provide visible buttons or overflow menu alternatives    |
| Drag and drop       | Provide add/remove/move controls or keyboard reordering  |
| Long press          | Do not require it; browsers reserve it for selection UI  |
| Hover reveal        | Keep controls available on touch and keyboard            |
| Keyboard shortcut   | Also provide menu/button path and announce shortcut text |

## Rules

1. Never make a hidden gesture the only way to complete a task.
2. Avoid gestures that conflict with scroll, back/forward navigation, selection, or zoom.
3. Pair drag-and-drop with explicit move, add, remove, or reorder controls.
4. Keep hover-only controls focusable and touch accessible.
5. Treat shortcuts as expert accelerators, not primary UI.
