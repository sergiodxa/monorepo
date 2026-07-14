---
title: Responsive Density and Chrome
impact: HIGH
tags: [apple-hig, density, toolbar, responsive]
---

# Responsive Density and Chrome

Tune density and visible chrome to the device class. Mobile needs breathing room and fewer controls; desktop can show more actions when they are organized and predictable.

## Why

- Dense mobile UI increases accidental taps and cognitive load
- Desktop users can scan toolbars and sidebars faster than nested menus
- Apple interfaces use restrained chrome so content remains central
- Responsive density avoids making desktop feel like a stretched phone screen

## Pattern

```tsx
// Bad: mobile and desktop both show every action in a cramped toolbar
<header mix={css({ display: "flex", gap: "0.25rem", padding: "0.5rem" })}>
  <button>Edit</button>
  <button>Share</button>
  <button>Export</button>
  <button>Duplicate</button>
  <button>Delete</button>
</header>

// Good: mobile keeps primary actions visible; desktop adds secondary actions
<header
  mix={css({
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "1rem",
    borderBottom: "1px solid var(--color-border)",
    "@media (min-width: 1024px)": { paddingInline: "2rem" },
  })}
>
  <div mix={css({ flex: 1, minWidth: 0 })}>
    <p mix={css({ margin: 0, color: "var(--color-muted-foreground)", fontSize: "0.875rem" })}>Project</p>
    <h1 mix={css({ margin: 0, fontSize: "1.25rem", fontWeight: 600 })}>Launch plan</h1>
  </div>
  <button mix={css({ minHeight: "2.75rem", paddingInline: "1rem", borderRadius: "999px" })}>Share</button>
  <button mix={css({ display: "none", "@media (min-width: 1024px)": { display: "inline-flex" } })}>Export</button>
  <button mix={css({ display: "none", "@media (min-width: 1024px)": { display: "inline-flex" } })}>Duplicate</button>
  <button
    aria-label="More actions"
    popovertarget="project-actions"
    mix={css({
      minWidth: "2.75rem",
      minHeight: "2.75rem",
      borderRadius: "999px",
      "@media (min-width: 1024px)": { display: "none" },
    })}
  >
    <MoreIcon aria-hidden="true" />
  </button>
</header>
```

```tsx
// Good: desktop content gains structure without increasing paragraph width
<main
	mix={css({
		display: "grid",
		gap: "2rem",
		maxWidth: "80rem",
		marginInline: "auto",
		padding: "1.5rem 1rem",
		"@media (min-width: 1024px)": {
			gridTemplateColumns: "minmax(0, 1fr) 20rem",
			paddingInline: "2rem",
		},
	})}
>
	<article mix={css({ maxWidth: "70ch" })}>...</article>
	<aside mix={css({ display: "none", "@media (min-width: 1024px)": { display: "block" } })}>
		...
	</aside>
</main>
```

## Density Guidelines

| Area               | Mobile                                      | Desktop                                      |
| ------------------ | ------------------------------------------- | -------------------------------------------- |
| Page padding       | Comfortable edge padding, safe-area support | Wider margins, centered content, panes       |
| Lists              | Larger rows, primary metadata only          | Denser rows, secondary columns when useful   |
| Toolbars           | Primary actions plus overflow               | Primary and common secondary actions visible |
| Inspectors/details | Route, dialog, popover, or disclosure       | Persistent side pane when useful             |
| Empty states       | Short copy and one action                   | Can include richer guidance or shortcuts     |

## Rules

1. Show fewer controls on mobile, not smaller controls.
2. Add desktop controls only when they are common enough to earn persistent space.
3. Keep mobile rows tall enough for touch and desktop rows dense enough for scanning.
4. Use overflow menus for secondary actions, not as a dumping ground for primary tasks.
5. Expand structure on desktop with panes and sidebars instead of stretching content width.
