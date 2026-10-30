# ADR-184: Bands Own the Landing Heading Outline

## Status

**Accepted** - 2026-10-30

## Background

`@sdxc/ui` resolves heading levels through `HeadingScope`: a heading renders at the nearest
scope's level, and a scope with no `level` sits one past its parent. Each landing pattern
(`LandingHero`, `FeatureBand`, `PricingBand`, `TestimonialBand`, `FaqBand`, `ClosingCta`,
`ProofStrip`) opened its own scope around its title, while a band assembled from
`MarketingSection` and `MarketingHeader` opened none, and `Bento` opened none around its cells.

## Context

- The outline a page got depended on how many scopes it wrapped around its bands. Wrapping none
  gave every band an `<h1>`; wrapping once gave patterns `<h2>` and hand-built bands `<h1>`;
  wrapping twice demoted the hero to `<h2>`. No arrangement gave "hero `h1`, bands `h2`,
  cards `h3`", and all three demo landings shipped a broken outline.
- `Bento.Title` resolved at its band's level, so cells ranked equal to the band title.
- Every reference landing has one `<h1>` from the hero and steps down from it.

## Decision

1. `MarketingSection` opens the scope. Its title level is its `level` prop, else one below the
   enclosing `MarketingSection`, else one below the ambient `HeadingScope`, else `2`.
2. `LandingHero` titles at its `level` prop, else the ambient scope's level, else `1`; headings in
   its `below` slot sit one level under it.
3. Patterns stop opening a scope around their title. Containers of titled cells (`Feature.Grid`,
   `Bento`, `StepList`, `PricingBand`'s plans) open one around their cells, so cards sit one level
   under whatever band holds them.
4. A page composes the documented components with no `HeadingScope` of its own. A landing nested
   under an existing heading (a docs article) wraps itself in one `HeadingScope` at that heading's
   level, and every heading shifts with it.
5. `packages/ui/src/patterns/outline.test.tsx` renders the documented page and holds it to
   `h1, h2…` with `h3` cards, bare and under one page-level scope.

A `MarketingPage` wrapper that provides the scope was considered and rejected: it adds a required
component whose only job is a number every band can work out for itself, and forgetting it brings
the broken outline back.

## Consequences

### Positive

- Any order of documented bands yields a sequential outline with no scope placed by hand.
- Hand-built and pattern bands agree, and cards always rank under their band.

### Negative

- A page that nested a second `HeadingScope` inside a first to reach `<h2>` bands now renders
  `<h2>` for its hero and `<h3>` for its bands, and drops the inner wrapper. One wrapper, around
  the bands or around the whole page, still yields the same outline.

### Neutral

- Visual sizes are unchanged; only the elements and the `data-heading-level` they carry move.
