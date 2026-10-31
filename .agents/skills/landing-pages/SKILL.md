---
name: landing-pages
description: Build or redesign a marketing landing page in this monorepo with @sdxc/ui — a product home, feature, audience, use-case or comparison page, a book or app landing, a pricing or trial page, a docs hub. Covers the story and section order, a visual for every band, honest proof, hierarchy and band rhythm, grids without orphans, CTAs, theming a brand through tokens, motion and accessibility, which component fits which section and where to learn it, and how to verify the page like a reviewer. Use before writing any landing view, when reviewing one, or when a page "looks fine but not great".
---

# Landing pages

A good landing reads as one argument: a promise, the proof that it is true, how it works, what it costs,
and one next step. Every band earns its place with something to look at, every number is real, and the
page holds up at 320px in dark mode as well as it does at 1440px in light. The components in
`@sdxc/ui/patterns` make each band; this skill is about choosing and arranging them so the page is good,
not merely assembled.

The rules come from three rounds of building and reviewing real pages. Learn from them in this order:

1. **`apps/sdxc-site/resources/views/demos/saas/`** (live at sdxc.dev/demo/saas) — the quality bar for a
   single page's visual craft: product UI in the hero, `Rails` chapters, `Bento` scenes, a theme built
   from tokens only.
2. **`apps/uptime`** — the bar for a family of pages: typed content records, one template per page kind,
   slug-to-mockup maps, honest proof, i18n, and the broadest regression tests.
3. **`apps/sdxc-site/resources/views/demos/book/`** and **`demos/app/`** — editorial and consumer
   art directions with their own section orders.
4. **`apps/sdxc-site/resources/docs/building-remix-apps/landing-pages.md`** — the public guide to the
   patterns, with runnable examples of every band.

## Workflow

1. **Write the story before any JSX.** One sentence for the promise, the three to six things that prove
   it, the one action you want. Pick the page kind and its section order from @rules/story-and-section-order.md.
2. **Inventory the truth.** List the real figures, quotes, logos and prices you have, and where each comes
   from (config, a count, a record). Sections without real proof are cut, not faked. @rules/honest-proof.md
3. **Plan a visual for every band** and make sure no two bands show the same one. @rules/a-visual-for-every-band.md
4. **Set the brand once through tokens**, then build bands from the patterns. @rules/theme-through-tokens.md,
   @rules/components-map.md
5. **Check hierarchy, rhythm, grids and CTAs** against @rules/hierarchy-and-rhythm.md,
   @rules/grids-without-orphans.md and @rules/ctas.md.
6. **Verify like a reviewer** at six widths in both themes, and lock what you fixed with tests.
   @rules/verify-like-a-reviewer.md

## Rules summary

### Story (CRITICAL)

#### story-and-section-order - @rules/story-and-section-order.md

Each page kind has a proven order. A product home runs hero → figures → try-it → benefits → linked
feature cards → split bands → pricing → FAQ → closing band.

```tsx
<LandingHero entrance mediaPlacement="end" media={<ProductMockup area="dashboard" />} … />
<MarketingSection spacing="compact"><StatStrip size="display" variant="gap">…</StatStrip></MarketingSection>
<FeatureBand layout="split" lean="media" media={<FlowDiagram … />}>…</FeatureBand>
<FaqBand columns={2}>…</FaqBand>
<ClosingCta tone="brand" inset … />
```

#### honest-proof - @rules/honest-proof.md

Never invent logos, customers, quotes, ratings or metrics. Every figure is read from code or config;
sample data lives only inside product mockups. No proof means no proof section.

```md
{% $packageCount %} packages   <- counted from the registry, cannot drift
"Trusted by 10,000 teams"      <- invented: cut it
```

### Visuals (CRITICAL)

#### a-visual-for-every-band - @rules/a-visual-for-every-band.md

Every band shows something: a product mockup, a card scene, a `FlowDiagram`, a `CodeStage`, a cover. A
text-only "How it works" becomes a split with a `StepList` timeline beside a visual the hero did not use.

```tsx
<FeatureBand layout="split" lean="media" title="How it works" media={<ProductMockup area="incidents" />}>
	<StepList variant="timeline">…</StepList>
</FeatureBand>
```

### Structure (HIGH)

#### hierarchy-and-rhythm - @rules/hierarchy-and-rhythm.md

One `h1` from the hero, `h2` per band, `h3` per card; bands alternate tone; every band has an eyebrow
and a short chapter title.

#### grids-without-orphans - @rules/grids-without-orphans.md

Pick the column count from the item count so the last row is full: 3 → 3, 4 → 2 or 4, 6 → 3, 9 → 3.
Stat strips carry four figures.

```ts
function columnsFor(count: number): Feature.Columns {
	return count % 3 === 0 ? 3 : 2;
}
```

#### ctas - @rules/ctas.md

One CTA shape per page, a brand primary and a `surface` secondary, both through `marketingCtaChrome()`,
and card actions pinned to the card foot with `Feature.Link`.

### Look (HIGH)

#### theme-through-tokens - @rules/theme-through-tokens.md

A brand is a palette plus `--ui-marketing-*` tokens, set once. Hover fills are `<scale>.bg-tint-hover`; a
misspelled token silently resolves to transparent.

#### motion-and-accessibility - @rules/motion-and-accessibility.md

`LandingHero entrance` and `viewReveal()` on bands, everything gated on reduced motion, a framed
mockup is one named image with `aria-hidden` insides, and text clears 4.5:1 on every band in both themes.

### Reference (MEDIUM)

#### components-map - @rules/components-map.md

Which pattern fits which section, its key props, and where to read its source, tests and live preview.

#### gotchas - @rules/gotchas.md

Cascade layers, island registration for `DialogDismiss`, stable ids and radio names, anchor offsets,
English default labels, heading scope in custom wrappers.

### Process (HIGH)

#### verify-like-a-reviewer - @rules/verify-like-a-reviewer.md

Check 320, 375, 768, 1024, 1280 and 1440 in light and dark; script the audit for overflow, orphans,
truncation and contrast; turn every layout or colour fix into a `*.browser.test.tsx` that fails on the
old code.

## When the bar is met

A reviewer comparing your page with sdxc.dev/demo/saas side by side should find: no band without a
visual, no invented proof, no orphan cell, no horizontal scroll, no truncated label, no CTA out of line,
no hover that moves anything, no raw translation key, one `h1`, and dark mode that looks designed rather
than inverted.
