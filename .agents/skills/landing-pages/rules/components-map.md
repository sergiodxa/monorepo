---
title: Components Map
impact: MEDIUM
tags: [components, patterns, reference, sdxc-ui]
---

# Components Map

Build every band from `@sdxc/ui/patterns` and `@sdxc/ui` before writing a custom one. When a section needs
something the library lacks, build it in the app from `MarketingSection` plus `@sdxc/u` mixins, and propose
upstreaming it only once a second page needs it.

## Why

- **The patterns already carry the review fixes**: equal-height code tabs, pinned card actions, orphan-free
  footers, heading levels, contrast on toned bands.
- **Hand-built bands drift**: each one re-decides spacing, radius and type the tokens already decide.

## Where to learn a component

For any component `<name>` (kebab-case):

1. **Source and JSDoc**: `packages/ui/src/patterns/<name>.tsx` or `packages/ui/src/components/<name>.tsx`.
   Props types live on the namespace (`LandingHero.Props`).
2. **Behaviour guarantees**: `<name>.browser.test.tsx` and `<name>.test.tsx` beside it.
3. **Live catalogue**: `https://sdxc.dev/api/ui/<name>`, with previews in
   `apps/sdxc-site/resources/components/previews/<name>.tsx` and `previews/<name>/*.tsx`.
4. **Real use**: grep the demos and Uptime (`rg "<FeatureBand" apps/sdxc-site/resources/views/demos apps/uptime`).
5. **Overviews**: sdxc.dev `/api/ui/landing-patterns`, `/api/ui/marketing-foundations`, `/api/ui/theming`,
   and the guide `apps/sdxc-site/resources/docs/building-remix-apps/landing-pages.md`.

## Which piece for which section

**Entry points**: bands come from `@sdxc/ui/patterns`; primitives (`MarketingSection`, `MarketingHeader`,
`Feature`, `StatStrip`, `LogoCloud`, `Split`, `CtaGroup`, `LinkButton`, `Accordion`, `DialogDismiss`) from
`@sdxc/ui`; `marketingCtaChrome()`, `marketingSurface()`, `eyebrow()`, `themeScope()` from
`@sdxc/ui/styles`; `viewReveal()` from `@sdxc/ui/animations`.

| Section | Use | Key props and notes |
| --- | --- | --- |
| Header | `SiteHeader` | `brand`, `items` (links or mega groups), `actions`, `cta`, `tools`, `sheet={<DialogDismiss />}`, `collapseAt`, stable `id`. A POST sign-in goes in `tools`. Render it first on the page |
| Hero | `LandingHero` | `title` (renders the `h1`), `eyebrow`/`eyebrowVariant`, `description`, `actions`, `note`, `proof`, `media`, `mediaPlacement` (`below`/`end`/`background`), `release`, `below`, `entrance`, `tone`, `align` |
| Title highlight | `AccentText` | inside `title`; `variant` `color`/`swash`/`highlight`/`sheen`/`pill`/`chip` |
| Proof strip | `ProofStrip`, `StatStrip`, `LogoCloud`, `LogoSentence` | logos only if real; `StatStrip size="display" variant="gap"` with four items |
| Plain band | `MarketingSection` + `MarketingHeader` | `tone`, `spacing`, `inset`, `ruled`; header `eyebrow`, `description`, `layout="split"`, `action` |
| Feature cards | `Feature.Grid` + `Feature` | `columns`, `variant` `cards`/`list`/`mosaic`; parts `.Icon`, `.Media`, `.Title`, `.Description`, `.Action` + `.Link`; `span` for wide cells |
| Split | `FeatureBand layout="split"` or `Split` | `lean="media"`, `media`; a `<ul>` child renders as checked claims |
| Steps | `StepList` | `variant="timeline"` inside a split; `StepList.Item title media` |
| Tour | `FeatureBand layout="stage"`, `TabbedStage`, `SegmentedStage` | page-unique `name`; `SegmentedStage` needs `aria-label` |
| Bento | `Bento` | `columns`, `Bento.Cell`, `.Media`, `.Title`, `.Body`; every cell has media |
| Code | `CodeStage` | `tabs`, `language`, `lineNumbers`, `variant` `code`/`slab`/`terminal`, unique `name` |
| Install | `InstallTabs` | package-manager switcher with copy actions |
| Process | `FlowDiagram` | `aria-label`, `trigger`, `steps`, `outcome`, `footnote`, `pauseLabel` |
| Product UI | `ProductFrame` | `lights`, `title`, `url`, `designWidth` + `fit`, `variant="device"`, `stage`, `footer` |
| Checks | `CheckList`, `CheckRow` | `orientation="horizontal"` for hero trust lines |
| Chapters | `Rails`, `Crosshair` | wrap each chapter in `HeadingScope level={2}` |
| Testimonials | `TestimonialBand` | only real quotes; `featured`, `layout="carousel"` |
| Pricing | `PricingBand` + `.Plan` | `columns` 2 or 3, `featured`, `badge`, `features`, `action` |
| Book and course | `Curriculum`, `AuthorBand` | `Curriculum.Part`/`.Lesson`; `AuthorBand jobTitle` |
| Changelog | `ChangelogStrip` | `.Entry dateTime date title href` |
| Sponsors | `SponsorWall` | real sponsors only |
| FAQ | `FaqBand` + `Accordion` | `columns={2}`; shared `name` on items; chevron with `data-slot="icon"` |
| Closing | `ClosingCta` | `tone="brand" inset`, same primary CTA as the hero |
| Footer | `SiteFooter` | `columns`, `brand`, `tagline`, `newsletter`, `social`, `legal`, `wordmark` |
| Motion | `MotionLoop`, `Marquee`, `RotatingText` | translated `pauseLabel` |

## A band of your own

```tsx
<MarketingSection tone="tinted" mix={[viewReveal()]}>
	<MarketingHeader eyebrow="Regions" description="…">Checked from nine regions</MarketingHeader>
	<div mix={[u.grid(), u.gridTemplate({ columns: u.repeat(3, 1) }), u.gap(4)]}>…</div>
</MarketingSection>
```

`MarketingSection` gives the container, spacing, tone and heading level; fill it with `@sdxc/u` mixins.
Prefer `@sdxc/ui` components over raw mixins, and `@sdxc/u` utilities over `raw({...})`.

## Rules

1. Reach for a pattern first; build a custom band on `MarketingSection` only when none fits.
2. Read a component's source JSDoc and browser tests before using an unfamiliar prop.
3. Check the live catalogue page for working examples.
4. Patterns are imports from `@sdxc/ui/patterns`; only `components/` can be copied with `sdxc ui add`.
