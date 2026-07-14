---
title: Navigation by Device Class
impact: HIGH
tags: [apple-hig, navigation, ios, macos, responsive]
---

# Navigation by Device Class

Choose navigation patterns that match the viewport and input mode. Mobile navigation should be obvious and reachable; desktop navigation should be persistent and scannable when the app has multiple areas.

## Why

- iOS users expect primary destinations and actions to be reachable without precision pointing
- macOS users benefit from persistent sidebars, toolbars, breadcrumbs, and keyboard navigation
- Hiding everything behind a hamburger on desktop slows expert users down
- Putting too many destinations in mobile navigation creates cramped, error-prone UI

## Pattern

```tsx
// Bad: same hidden navigation everywhere
<button aria-controls="main-menu">Menu</button>
<nav id="main-menu" hidden>
  <a href="/dashboard">Dashboard</a>
  <a href="/projects">Projects</a>
  <a href="/settings">Settings</a>
</nav>

// Good: bottom navigation for primary mobile destinations, persistent desktop sidebar
<nav
  aria-label="Primary"
  mix={css({
    position: "fixed",
    insetInline: 0,
    bottom: 0,
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    paddingBottom: "env(safe-area-inset-bottom)",
    borderTop: "1px solid var(--color-border)",
    backgroundColor: "var(--color-background)",
    "@media (min-width: 1024px)": { display: "none" },
  })}
>
  <a mix={css({ display: "grid", minHeight: "3.5rem", placeItems: "center" })} href="/dashboard">Home</a>
  <a mix={css({ display: "grid", minHeight: "3.5rem", placeItems: "center" })} href="/projects">Projects</a>
  <a mix={css({ display: "grid", minHeight: "3.5rem", placeItems: "center" })} href="/activity">Activity</a>
  <a mix={css({ display: "grid", minHeight: "3.5rem", placeItems: "center" })} href="/settings">Settings</a>
</nav>

<aside
  mix={css({
    display: "none",
    borderRight: "1px solid var(--color-border)",
    "@media (min-width: 1024px)": { display: "block" },
  })}
>
  <nav aria-label="Primary" mix={css({ display: "grid", gap: "0.25rem", padding: "0.75rem" })}>
    <a mix={css({ borderRadius: "0.5rem", padding: "0.5rem 0.75rem" })} href="/dashboard">Home</a>
    <a mix={css({ borderRadius: "0.5rem", padding: "0.5rem 0.75rem" })} href="/projects">Projects</a>
    <a mix={css({ borderRadius: "0.5rem", padding: "0.5rem 0.75rem" })} href="/activity">Activity</a>
    <a mix={css({ borderRadius: "0.5rem", padding: "0.5rem 0.75rem" })} href="/settings">Settings</a>
  </nav>
</aside>
```

```tsx
// Good: desktop breadcrumbs add orientation without crowding mobile
<nav
	aria-label="Breadcrumb"
	mix={css({ display: "none", "@media (min-width: 1024px)": { display: "block" } })}
>
	<ol
		mix={css({
			display: "flex",
			gap: "0.5rem",
			color: "var(--color-muted-foreground)",
			fontSize: "0.875rem",
		})}
	>
		<li>
			<a href="/projects">Projects</a>
		</li>
		<li aria-hidden="true">/</li>
		<li>
			<a href="/projects/alpha">Alpha</a>
		</li>
	</ol>
</nav>
```

## Navigation Choices

| App shape                     | Mobile pattern                        | Desktop pattern                     |
| ----------------------------- | ------------------------------------- | ----------------------------------- |
| 3 to 5 top-level destinations | Bottom tabs or simple top tabs        | Sidebar or top navigation           |
| Deep hierarchy                | Back links, breadcrumbs, route titles | Sidebar, breadcrumbs, master-detail |
| Content creation              | Prominent floating or toolbar CTA     | Toolbar primary button              |
| Rare settings/admin screens   | Account/settings route                | Secondary sidebar section or menu   |

## Rules

1. Keep mobile primary navigation to the few destinations users need most.
2. Use persistent desktop navigation for multi-section apps.
3. Preserve orientation with page titles, selected nav state, and breadcrumbs for deep paths.
4. Avoid desktop hamburger menus unless space is genuinely constrained.
5. Keep destructive or rarely used actions out of primary navigation.
