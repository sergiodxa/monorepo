---
title: A card that fits anywhere, with container queries
description: Lay a card out by the width of the slot it sits in rather than the width of the window, so one component works in a sidebar, a grid and a full-width row.
kind: tutorials
date: "2026-01-20"
tags: [css, layout, components]
---

A card styled with media queries knows the width of the window, not the width it has. Put it in a narrow sidebar on a wide screen and it tries its wide layout in 18rem. Container queries fix that by letting the card ask its container instead.

## Step 1: Make the slot a container

The element that decides the card's width becomes a query container. `inline-size` containment is the one you want almost always; it only measures width, so it does not interfere with the height of the content.

```css {% title="card.css" %}
.card-slot {
	container-type: inline-size;
}
```

> [!WARNING]
> An element cannot query itself. Put `container-type` on a wrapper, not on the card, or the card's own rules will never match.

## Step 2: Write the narrow layout first

Stack everything by default, so the card works in the smallest slot without any query.

```css {% title="card.css" %}
.card {
	display: grid;
	gap: 0.75rem;
}
```

## Step 3: Switch layout when there is room

From 30rem of container width, put the image beside the text. Inside a container query, `cqi` is one percent of the container's inline size, which is useful for spacing that grows with the slot.

```css {% title="card.css" %}
@container (min-width: 30rem) {
	.card {
		grid-template-columns: 12rem 1fr;
		gap: 4cqi;
	}
}
```

Now drop the same card into a sidebar, a three-column grid and a full-width list. Each one picks its layout from the space it was given, and no page has to know which card variant to render.
