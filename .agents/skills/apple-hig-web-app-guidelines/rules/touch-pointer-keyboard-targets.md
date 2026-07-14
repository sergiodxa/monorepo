---
title: Touch, Pointer, and Keyboard Targets
impact: HIGH
tags: [apple-hig, input, touch, pointer, keyboard, accessibility]
---

# Touch, Pointer, and Keyboard Targets

Design interactive elements for touch first, then enhance for pointer precision and keyboard efficiency. Apple's 44pt target guidance maps to at least 44x44 CSS pixels for touch controls.

## Why

- iPhone and iPad users need large targets that work with thumbs and fingers
- Mac users expect hover states, focus rings, keyboard navigation, and pointer affordances
- Web apps often run on hybrid devices where touch, trackpad, mouse, and keyboard are all possible
- Semantic controls provide accessibility and keyboard behavior without custom JavaScript

## Pattern

```tsx
// Bad: non-semantic clickable region, tiny target, no built-in keyboard behavior
<div mix={css({ width: "1.5rem", height: "1.5rem", cursor: "pointer" })}>
  <GearIcon />
</div>

// Good: semantic button with touch size, focus style, and accessible name
<button
  type="button"
  aria-label="Open settings"
  mix={[
    css({
      minWidth: "2.75rem",
      minHeight: "2.75rem",
      padding: "0.75rem",
      borderRadius: "999px",
      cursor: "pointer",
      "&:hover": { backgroundColor: "var(--color-muted)" },
      "&:focus-visible": { outline: "2px solid var(--color-focus)", outlineOffset: 2 },
    }),
    on("click", openSettings),
  ]}
>
  <GearIcon aria-hidden="true" />
</button>
```

```tsx
// Good: list row has a large target on mobile and supports pointer affordances
<a
	href="/projects/alpha"
	mix={css({
		display: "block",
		padding: "0.75rem 1rem",
		borderRadius: "0.75rem",
		"&:hover": { backgroundColor: "var(--color-muted)" },
		"&:focus-visible": { outline: "2px solid var(--color-focus)", outlineOffset: 2 },
		"@media (min-width: 1024px)": { paddingBlock: "0.5rem" },
	})}
>
	<span mix={css({ display: "block", fontWeight: 500 })}>Alpha</span>
	<span
		mix={css({ display: "block", color: "var(--color-muted-foreground)", fontSize: "0.875rem" })}
	>
		Updated today
	</span>
</a>
```

## Target Guidance

| Input mode | Guidance                                                     |
| ---------- | ------------------------------------------------------------ |
| Touch      | At least 44x44px target; increase spacing for small targets  |
| Pointer    | Hover affordances can help, but do not hide required actions |
| Keyboard   | Logical tab order, visible focus, semantic buttons and links |
| Hybrid     | Assume users may switch input modes during the same session  |

## Rules

1. Use native `<button>`, `<a>`, `<input>`, `<select>`, and `<textarea>` before custom controls.
2. Give touch controls at least a 44x44px interactive area.
3. Make focus states visible and not color-only.
4. Use hover to enhance discovery, not to hide essential actions.
5. Keep target spacing generous when actions are destructive or adjacent.
