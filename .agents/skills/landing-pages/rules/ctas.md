---
title: Calls to Action
impact: HIGH
tags: [cta, buttons, links, cards]
---

# Calls to Action

A page has one primary action, repeated in the header, the hero and the closing band, in one shape.
Secondary actions look clearly secondary but never disabled. Card actions sit on the card's foot so a row
of cards reads as aligned.

## Why

- **Shape is a brand signal**: pill buttons beside 6px pricing buttons and a square sign-in read as three
  sites stitched together.
- **Aligned actions read as designed**: link buttons at different heights inside cards were the first
  thing the user flagged on sdxc.dev.
- **Grey secondaries look disabled**: readers skip them.

## Pattern

```tsx
// Hero and closing actions
<LandingHero
	actions={
		<>
			<LinkButton href="#start" color="brand" mix={[marketingCtaChrome()]}>Start free</LinkButton>
			<LinkButton href="#pricing" variant="surface" mix={[marketingCtaChrome()]}>See pricing</LinkButton>
		</>
	}
	…
/>
```

```tsx
// Bad: a LinkButton in the description, wherever the text ends
<Feature><Feature.Description>… <LinkButton href={href}>Learn more</LinkButton></Feature.Description></Feature>

// Good: a quiet text link pinned to the card foot; the whole card is the hit target
<Feature href={href}>
	<Feature.Media>{scene}</Feature.Media>
	<Feature.Title>{title}</Feature.Title>
	<Feature.Description>{description}</Feature.Description>
	<Feature.Action><Feature.Link href={href}>Learn more</Feature.Link></Feature.Action>
</Feature>
```

## Details

- Primary is `color="brand"`; secondary is `variant="surface"` (white fill, ring, emphasis text). A text
  link with an arrow is also a fine secondary.
- `marketingCtaChrome()` applies the page's CTA radius and weight; `CtaGroup` gives the 40px height.
  Pricing plan buttons, header CTA and the phone sheet CTA use the same chrome.
- Set the shape once on the page root: `--ui-marketing-cta-radius` (pill, rounded or square).
- On a `brand` or `inverse` band the primary inverts (dark on brand) and the secondary is a translucent ring.
- At 375px actions stack full width (`CtaGroup stack="phone"`).
- Arrows nudge 2px through `transform`, only under motion-safe, and never change the box size.
- Keep labels short enough to stay on one line at 320px.

## Rules

1. One primary action per page, repeated in header, hero and closing band.
2. Every button goes through `marketingCtaChrome()`; set the radius once with `--ui-marketing-cta-radius`.
3. Use `variant="surface"` or an arrow text link for secondaries, never a grey solid.
4. Put card actions in `Feature.Action` with `Feature.Link`.
5. Hover moves nothing but the arrow, by transform.
