---
title: A Visual for Every Band
impact: CRITICAL
tags: [visuals, mockups, scenes, bento, code-stage]
---

# A Visual for Every Band

Every band shows something besides text: an inline product mockup, a card scene, a diagram, a code stage,
a cover or a sample page. Draw product UI as live markup inside the page, not as a screenshot, and never
show the same visual twice on one page.

## Why

- **Text-only bands are where readers leave.** Reviews of the redesigned pages found the weakest bands
  were always the text-only "How it works" and "capabilities" bands.
- **Inline mockups stay true**: they use the product's own labels and theme, follow dark mode, translate,
  and never go stale like a PNG.
- **Repetition reads as filler**: a hero mockup repeated in the spotlight tells the reader there is
  nothing else to see.

## Pattern

```tsx
// Bad: a list of steps beside nothing
<FeatureBand layout="steps" title="How it works">
	<StepList.Item title="Add a URL">…</StepList.Item>
</FeatureBand>

// Good: a timeline beside a visual the hero did not use
<FeatureBand layout="split" lean="media" title="How it works" media={featureCompanion(slug, t)}>
	<StepList variant="timeline">
		<StepList.Item title="Add a URL">…</StepList.Item>
	</StepList>
</FeatureBand>
```

## Kinds of visual

- **Product mockup**: a `ProductFrame` around drawn product UI. The Uptime set is the model:
  `apps/uptime/resources/components/marketing/product-mockups/` (`parts.tsx` has `MockupWindow`, the rail,
  panels and rows; `sample-data.ts` is shared with the card scenes so hosts match across the page).
- **Card scene**: a cropped fragment of product UI at the top of a feature card, in a fixed-height frame so
  titles line up per row (`sceneFrame()` in `apps/uptime/resources/components/marketing/product-scenes.tsx`,
  18rem tall, overflow clipped; `Feature.Media` fades the lower half).
- **Bento scene**: a small illustration per `Bento.Cell`, padded and anchored to the bottom edge
  (`apps/sdxc-site/resources/views/demos/saas/bento-media.tsx`, `demos/app/bento-scenes.tsx`).
- **Code**: `CodeStage` with `tabs`, `language` and a page-unique `name`; sample code in one module
  (`apps/uptime/resources/content/code-samples.ts`).
- **Process**: `FlowDiagram` for a trigger → steps → outcome run, animated and pausable.
- **Switchers**: `SegmentedStage` (hero screens) and `TabbedStage` (a tour), CSS-only, all panels in one
  grid cell so switching never changes height.
- **Physical things**: a flat book cover, a sample page, a device frame (`ProductFrame variant="device"`).

## Mockups on phones

A product screen keeps its desktop composition and scales or crops on narrow screens; it never reflows
into a different layout.

```tsx
<ProductFrame lights title={title} url={url} designWidth="32rem" fit="scale" role="img" aria-label={label}>
	<div aria-hidden="true" data-slot="product-mockup">…</div>
</ProductFrame>
```

`fit="scale"` zooms the whole canvas below its design width; `fit="crop"` keeps the width and fades the
end edge. The hero's primary screen may instead reflow through container queries when its text must stay
legible (`apps/sdxc-site/resources/views/demos/saas/revenue-board.tsx` with `showFrom()`), but then a
browser test must prove no label is clipped at 343px.

The hero's media must be at least as tall as its copy and look like a dense, real product. A one-line
frame or a "media goes here" placeholder fails review.

## Cards: all media or all icons

Within one grid, give every card a scene or every card an icon. `Feature.Media` hides below the `md`
container, so a mixed set changes shape on phones.

## Rules

1. Give every band a visual; turn text-only steps into a split with a timeline beside a visual.
2. Draw product UI inline with the product's own labels and shared sample data.
3. Never show the same mockup twice on one page; keep per-slug choices in maps and test them.
4. Scale or crop mockups on phones with `designWidth` and `fit`; never let them reflow by accident.
5. Hold card scenes to one fixed height so card titles align per row.
6. Keep one grid all-media or all-icons.
