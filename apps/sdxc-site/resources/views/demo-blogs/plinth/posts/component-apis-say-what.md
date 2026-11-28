---
title: Component props should say what, not how
description: A prop named color invites every colour. A prop named tone offers four meanings. Design-system APIs age better when they describe intent.
kind: articles
date: "2026-05-12"
tags: [components, tokens, accessibility]
---

The first version of every badge component I have reviewed takes a `color` prop. It feels flexible. A year later the codebase has badges in eleven colours, three of them nearly identical, and nobody can say what a purple badge means.

## Describe the meaning

The fix is to make the prop describe why, not how. A badge does not need a colour; it needs a tone:

```tsx {% title="badge.tsx" %}
interface BadgeProps {
	tone?: "neutral" | "info" | "success" | "critical";
	children: string;
}
```

Four values, each with a meaning a product designer can choose by. The component maps each tone to semantic tokens, and the tokens decide the colour in each theme. When critical moves from red to a deeper red for contrast, no call site changes.

## Intent constrains combinations

Props that describe styling multiply. `size`, `color`, `weight` and `rounded` give hundreds of combinations, most of them unreviewed. Props that describe intent collapse them: a button is `primary`, `secondary` or `quiet`, and each of those already knows its weight and its colour.

> [!NOTE]
> This also helps accessibility. A `critical` tone can carry an icon and an accessible label alongside the colour, so the meaning never rests on colour alone. A `color="red"` prop has no idea it should.

## Leave an escape hatch, once

Teams will need something the system does not offer. Give them one, clearly named, such as a `className` or a `mix` slot, and track how often it is used. Every repeated escape is a missing tone, and the next release should add it. What you should not add is a `color` prop that accepts anything, because then the escape hatch becomes the API.
