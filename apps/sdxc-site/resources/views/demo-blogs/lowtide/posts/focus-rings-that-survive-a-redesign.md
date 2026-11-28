---
title: Focus rings that survive a redesign
description: Build a focus style from two custom properties so it stays visible on every background a future designer picks.
kind: tutorials
date: "2026-05-14"
tags: [css, accessibility]
---

Focus rings get removed in redesigns because they clash with something. The fix is a ring built to sit on anything.

## Step 1: Use focus-visible

`:focus-visible` shows the ring for keyboard users and hides it after a mouse click, which removes the main reason designers ask for it to go.

```css {% title="focus.css" %}
:where(a, button, input, select, textarea):focus-visible {
	outline: 2px solid var(--focus-color, currentColor);
	outline-offset: 2px;
}
```

## Step 2: Add a halo

A second ring in the page's background colour separates the outline from any surface, light or dark.

```css {% title="focus.css" %}
:where(a, button, input, select, textarea):focus-visible {
	box-shadow: 0 0 0 4px var(--focus-halo, Canvas);
}
```

## Step 3: Check it in forced colours

Windows high-contrast mode drops box shadows but keeps outlines, so the outline must carry the ring alone. Toggle forced colours in your browser's rendering tools and tab through the page.
