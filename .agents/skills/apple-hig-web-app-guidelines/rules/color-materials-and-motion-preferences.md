---
title: Color, Materials, and Motion Preferences
impact: MEDIUM
tags: [apple-hig, color, motion, dark-mode, contrast]
---

# Color, Materials, and Motion Preferences

Use color, translucency, blur, shadow, and motion with restraint. They should clarify state and hierarchy while respecting dark mode, contrast, and reduced-motion preferences.

## Why

- Apple interfaces use color and materials to support hierarchy, not overwhelm content
- Web translucency and blur can reduce contrast when placed over unpredictable content
- Motion can communicate continuity, but it can also trigger vestibular discomfort
- Semantic color tokens make dark mode and high-contrast adjustments safer

## Pattern

```tsx
// Bad: color-only state and heavy material effect over text
<div mix={css({ padding: "1rem", backgroundColor: "rgb(255 255 255 / 0.2)", backdropFilter: "blur(48px)" })}>
  <span mix={css({ color: "#ef4444" })}>Failed</span>
  <p>Payment could not be processed.</p>
</div>

// Good: semantic state, sufficient contrast, and non-color cue
<div
  mix={css({
    padding: "1rem",
    border: "1px solid var(--color-failure-border)",
    borderRadius: "1rem",
    backgroundColor: "var(--color-failure-subtle)",
    color: "var(--color-failure-foreground)",
  })}
>
  <h2 mix={css({ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600 })}>
    <WarningIcon aria-hidden="true" />
    Payment failed
  </h2>
  <p>Update the card or choose a different payment method.</p>
</div>
```

```tsx
// Good: motion is modest and disabled for users who request reduced motion
<div
	data-open={isOpen ? "true" : "false"}
	mix={css({
		transition: "transform 200ms ease-out",
		'&[data-open="true"]': { transform: "translateY(0)" },
		'&[data-open="false"]': { transform: "translateY(0.5rem)" },
		"@media (prefers-reduced-motion: reduce)": { transition: "none" },
	})}
>
	<Notification />
</div>
```

```tsx
// Good: translucent chrome remains optional and contrast-safe
<header
	mix={css({
		borderBottom: "1px solid var(--color-border)",
		backgroundColor: "var(--color-background)",
		"@supports (backdrop-filter: blur(1px))": {
			backgroundColor: "rgb(from var(--color-background) r g b / 0.82)",
			backdropFilter: "blur(16px)",
		},
	})}
>
	<Toolbar />
</header>
```

## Visual Guidance

| Technique     | Use for                                | Avoid                                          |
| ------------- | -------------------------------------- | ---------------------------------------------- |
| Color         | State, selection, brand accent         | Communicating meaning without text/icon cues   |
| Blur/material | Lightweight chrome over stable content | Text-heavy surfaces over busy backgrounds      |
| Shadow        | Elevation and active layers            | Decorating every card equally                  |
| Motion        | Continuity, feedback, focus changes    | Long, looping, parallax, or essential movement |
| Dark mode     | Matching user preference and app theme | Inverting colors without checking contrast     |

## Rules

1. Use semantic color tokens for state and theme support.
2. Pair color with text, icons, shape, or position when communicating meaning.
3. Keep blur and translucency subtle and contrast-safe.
4. Respect `prefers-reduced-motion` for transitions, animations, and scroll effects.
5. Use depth to distinguish active layers, not to decorate every surface.
