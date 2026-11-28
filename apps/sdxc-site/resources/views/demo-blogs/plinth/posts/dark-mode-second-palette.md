---
title: Dark mode is a second palette, not an inversion
description: Inverting a light theme gives you glowing text, flat surfaces and failing contrast. A dark theme needs its own decisions about elevation, chroma and weight.
kind: articles
date: "2025-12-02"
tags: [color, accessibility, tokens]
featured: true
---

The quickest dark mode is to swap the lightest and darkest steps of every scale. It ships in an afternoon, and it looks wrong in ways that are hard to name until you list them.

## Surfaces get lighter as they rise

In a light theme, a raised card is the same white as the page with a shadow under it. Shadows barely show on a near-black page, so a dark theme signals elevation with lightness instead: the page is the darkest surface, and each layer above it is a step lighter.

```css {% title="tokens/dark.css" %}
:root[data-theme="dark"] {
	--surface-page: oklch(0.17 0.005 265);
	--surface-raised: oklch(0.22 0.006 265);
	--surface-overlay: oklch(0.27 0.007 265);
}
```

## Pure white text glares

White on near-black is a contrast ratio far beyond what reading needs, and on many screens the strokes bloom. I set body text a few steps down from white and keep pure white for the rare thing that must stand out.

## Saturated colours vibrate

A signal orange that looks crisp on white seems to vibrate on black. In the dark theme I raise its lightness and lower its chroma a little, and check it against the page with the same contrast rule as text.

> [!WARNING]
> Check contrast in both themes separately. A pair that passes in light mode tells you nothing about its dark counterpart, and a token pipeline can generate the report for both from one source.

## Type looks heavier

Light text on a dark ground reads bolder than the same weight inverted. If your type system has the weights, step body text down one in dark mode, or at least avoid the heaviest weights for long passages.

None of these decisions are an inversion. They are a second palette, designed with the same care as the first, and expressed as overrides of [semantic tokens](/showcase/plinth/demo/glossary/design-token) so components never know which theme they are in.
