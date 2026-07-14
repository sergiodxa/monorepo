---
title: Typography and Readable Content
impact: MEDIUM
tags: [apple-hig, typography, content, readability, responsive]
---

# Typography and Readable Content

Use type to create hierarchy, preserve readability, and respect user scaling. Web apps should support zoom and scalable text rather than hard-coded native point sizes.

## Why

- Readability is one of the strongest contributors to perceived polish
- iOS users may rely on browser zoom and accessibility text settings
- macOS users often view wider windows where uncontrolled line length hurts comprehension
- Consistent hierarchy helps users scan without decorative separators

## Pattern

```tsx
// Bad: fixed small type and a full-width reading measure
<article mix={css({ width: "100%", fontSize: "12px", lineHeight: "14px" })}>
  <h1 mix={css({ fontSize: "18px" })}>Release notes</h1>
  <p>{body}</p>
</article>

// Good: scalable type and comfortable measure
<article
  mix={css({
    maxWidth: "70ch",
    marginInline: "auto",
    paddingInline: "1rem",
    fontSize: "1rem",
    lineHeight: 1.7,
    "@media (min-width: 1024px)": { fontSize: "1.125rem", lineHeight: 1.75 },
  })}
>
  <p mix={css({ color: "var(--color-muted-foreground)", fontSize: "0.875rem" })}>Release notes</p>
  <h1 mix={css({ fontSize: "2rem", fontWeight: 650, letterSpacing: "-0.03em" })}>What's new</h1>
  <p>{body}</p>
</article>
```

```tsx
// Good: dashboard text hierarchy works at compact and regular widths
<section
	mix={css({
		display: "grid",
		gap: "0.5rem",
		padding: "1rem",
		border: "1px solid var(--color-border)",
		borderRadius: "1rem",
	})}
>
	<p
		mix={css({
			margin: 0,
			color: "var(--color-muted-foreground)",
			fontSize: "0.875rem",
			fontWeight: 500,
		})}
	>
		Monthly revenue
	</p>
	<p
		mix={css({ margin: 0, fontSize: "2rem", fontVariantNumeric: "tabular-nums", fontWeight: 650 })}
	>
		$42,910
	</p>
	<p mix={css({ margin: 0, color: "var(--color-success)", fontSize: "0.875rem" })}>
		Up 12% from last month
	</p>
</section>
```

## Typography Guidance

| Text type    | Guidance                                                     |
| ------------ | ------------------------------------------------------------ |
| Page titles  | Clear, specific, and visually dominant                       |
| Body text    | Use `rem`-based sizing, generous line height, and max width  |
| Metadata     | Smaller and quieter, but still readable                      |
| Numbers      | Use tabular numbers for aligned financial or metric displays |
| Long content | Prefer a `max-width` near `65ch` to `75ch`                   |

## Rules

1. Use content-specific headings; avoid vague titles like `Details` when context is unclear.
2. Prefer scalable units and app typography tokens over fixed pixel micro-type.
3. Keep long-form text at a comfortable measure instead of filling desktop width.
4. Use weight, size, and spacing before adding extra borders or decoration.
5. Do not load Apple system fonts from external sources; use the app's type system or a system font stack.
