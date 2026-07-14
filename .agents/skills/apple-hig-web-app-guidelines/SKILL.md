---
name: apple-hig-web-app-guidelines
description: Apple Human Interface Guidelines adapted for Remix UI web apps. Use when designing or reviewing responsive mobile iOS-like and desktop macOS-like UIs, navigation, controls, visual hierarchy, feedback, and platform-appropriate interactions.
---

# Apple HIG for Remix UI Web Apps

Design guidance based on Apple's Human Interface Guidelines, adapted for browser-based apps in this monorepo. Contains 10 rules across 5 categories focused on applying iOS and macOS design principles with `remix/ui` JSX and `css()` mixins, not React components or utility CSS classes.

Source: https://developer.apple.com/design/human-interface-guidelines/

## When to Apply

Reference these guidelines when:

- Designing or reviewing a web UI that should feel polished on iPhone, iPad, and Mac browsers
- Building responsive layouts with distinct mobile and desktop behavior
- Choosing navigation, toolbars, sidebars, dialogs, popovers, forms, or settings patterns
- Refining visual hierarchy, density, touch targets, feedback, or motion
- Translating Apple HIG recommendations to Remix UI and web primitives instead of native app APIs

## Scope for Web Apps

Use the HIG as product design guidance, not as a requirement to copy native Apple apps. Ignore platform-only guidance that web apps cannot implement meaningfully, such as CarPlay, watchOS, tvOS, visionOS, system extensions, hardware-only sensors, App Store flows, native menu bar APIs, and OS-level permissions UI.

Use `remix/ui` components and host elements with `mix={css(...)}` for styling. Use `on(...)`, `ref(...)`, `link(...)`, and native platform features when behavior is needed. Do not introduce React hooks, React component patterns, `className`, or Tailwind utility classes.

Prefer browser conventions and this monorepo's existing design system. Do not fake native system chrome, home indicators, traffic-light window controls, or Safari UI.

## Rules Summary

### Design Principles (HIGH)

#### hig-scope-for-web - @rules/hig-scope-for-web.md

Translate HIG guidance into Remix UI and web capabilities instead of copying native-only surfaces.

```tsx
// Bad: fake native chrome in a browser page
<div mix={css({ position: "fixed", bottom: "0.5rem", height: "0.25rem" })} />

// Good: account for real browser safe areas
<main mix={css({ minHeight: "100dvh", paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" })}>
  ...
</main>
```

#### clarity-deference-depth - @rules/clarity-deference-depth.md

Make content and purpose obvious, keep UI chrome secondary, and use layering to preserve context.

```tsx
// Bad: ambiguous icon-only action
<button><ArchiveIcon /></button>

// Good: clear label, secondary icon
<button mix={css({ display: "inline-flex", alignItems: "center", gap: "0.5rem" })}>
  <ArchiveIcon aria-hidden="true" />
  Archive invoice
</button>
```

### iOS and macOS Adaptation (HIGH)

#### adaptive-ios-macos-layouts - @rules/adaptive-ios-macos-layouts.md

Use compact, task-focused layouts on mobile and persistent multi-pane layouts on desktop.

```tsx
<div
	mix={css({
		display: "grid",
		gap: "1rem",
		"@media (min-width: 1024px)": {
			gridTemplateColumns: "18rem minmax(0, 1fr)",
			gap: "2rem",
		},
	})}
>
	...
</div>
```

#### navigation-by-device-class - @rules/navigation-by-device-class.md

Prefer bottom or simple top navigation on mobile and persistent sidebar or toolbar navigation on desktop.

```tsx
<nav aria-label="Primary" mix={css({ position: "fixed", insetInline: 0, bottom: 0 })}>
	...
</nav>
```

#### responsive-density-and-chrome - @rules/responsive-density-and-chrome.md

Reduce chrome and density on mobile, then add visible structure and secondary controls on desktop.

```tsx
<header mix={css({ display: "flex", gap: "0.75rem", padding: "1rem" })}>
	<h1 mix={css({ flex: 1, fontSize: "1.25rem" })}>Projects</h1>
	<button>New</button>
</header>
```

### Input and Interaction (HIGH)

#### touch-pointer-keyboard-targets - @rules/touch-pointer-keyboard-targets.md

Design controls for touch first, then enhance for pointer and keyboard users.

```tsx
<button mix={css({ minWidth: "2.75rem", minHeight: "2.75rem", borderRadius: "999px" })}>
	Share
</button>
```

#### gestures-need-visible-alternatives - @rules/gestures-need-visible-alternatives.md

Treat swipe, drag, hover, and keyboard shortcuts as enhancements, never the only path.

```tsx
<article>
	<h2>Quarterly report</h2>
	<button>Delete</button>
</article>
```

### Visual Design (MEDIUM)

#### typography-and-readable-content - @rules/typography-and-readable-content.md

Use readable type, scalable sizing, and line lengths that adapt across iOS and macOS viewports.

```tsx
<article mix={css({ maxWidth: "70ch", marginInline: "auto", fontSize: "1rem", lineHeight: 1.7 })}>
	...
</article>
```

#### color-materials-and-motion-preferences - @rules/color-materials-and-motion-preferences.md

Use semantic colors, restrained depth, sufficient contrast, and user motion/color-scheme preferences.

```tsx
<div
	mix={css({
		backgroundColor: "var(--color-background)",
		color: "var(--color-foreground)",
		"@media (prefers-reduced-motion: reduce)": { transition: "none" },
	})}
>
	...
</div>
```

### Feedback and Safety (HIGH)

#### controls-feedback-and-destructive-actions - @rules/controls-feedback-and-destructive-actions.md

Make control states immediate, progress visible, and destructive actions explicit.

```tsx
<button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
	{isSubmitting ? "Saving..." : "Save changes"}
</button>
```

## Related Skills

- Use `remix` for implementation details around `remix/ui`, `css(...)`, `on(...)`, component handles, and server-rendered UI.
- Use `web-design-guidelines` when the user asks for a broad UI audit.
