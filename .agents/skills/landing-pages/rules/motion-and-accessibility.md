---
title: Motion and Accessibility
impact: HIGH
tags: [motion, a11y, contrast, aria, reduced-motion]
---

# Motion and Accessibility

Motion is a small entrance and quiet reveals, always behind `prefers-reduced-motion`, and the static render
shows the finished state. Accessibility is mostly naming: a framed mockup is one named image, decoration is
hidden, and every text node clears 4.5:1 against the band it sits on.

## Why

- **Motion that moves layout reads as jitter**: an arrow that changed size on hover was a reported bug.
- **A drawn mockup is a lot of fake text**: without `aria-hidden`, a screen reader recites a fake
  dashboard.
- **Tinted and brand bands lower contrast**: muted text measured 3.3:1 and brand-band leads 3.8:1 before
  the review fixed them.

## Pattern

```tsx
<LandingHero entrance … />
<MarketingSection mix={[viewReveal()]} tone="tinted">…</MarketingSection>

// One named image; the drawn UI inside is hidden
<ProductFrame role="img" aria-label="Uptime dashboard showing three monitors" designWidth="32rem" fit="scale">
	<div aria-hidden="true" data-slot="product-mockup">…</div>
</ProductFrame>

// A decorative card scene is hidden entirely; the card title carries the meaning
<Feature.Media><div aria-hidden="true">…</div></Feature.Media>
```

## Motion

- `LandingHero entrance` for the first paint, `viewReveal()` (`@sdxc/ui/animations`) on bands.
- Loops longer than five seconds sit in `MotionLoop` so they can be paused (`FlowDiagram`, `Marquee` do this
  already); pass a translated `pauseLabel`.
- Hover changes colour and nudges arrows by `transform`; it never changes padding, borders or size.
- Use at most one flourish of each kind per page (one `AccentText` swash, one marquee).
- For full-page screenshots, inject `*{animation:none!important}` first, or `viewReveal()` bands render at
  opacity 0.

## Accessibility

- `aria-hidden="true"` exactly (tests compare the string).
- Icons beside text are `aria-hidden`.
- Glyph figures (`∞`) are `aria-hidden` with a visually hidden `valueLabel` beside them.
- Mock text has an 11px floor; avatar stacks use one readable initial.
- Focus rings stay visible on `inverse` and `brand` bands.
- Tap targets are 44px or more; hide keyboard hints (`⌘K`) on `(pointer: coarse)`.
- A sticky header covers anchors; give `main [id]` a `scroll-margin-block-start` around 4.5–5rem.

## Rules

1. Use `entrance` and `viewReveal()`; gate everything on reduced motion and render the finished state.
2. Make a framed mockup one `role="img"` with a label and `aria-hidden="true"` insides.
3. Hide decorative scenes and icons.
4. Measure contrast on every band tone in both themes; 4.5:1 for body, 3:1 for large text.
5. Never change an element's box on hover.
