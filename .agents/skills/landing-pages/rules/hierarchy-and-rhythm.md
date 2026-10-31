---
title: Hierarchy and Rhythm
impact: HIGH
tags: [headings, eyebrows, tones, spacing, typography]
---

# Hierarchy and Rhythm

The hero renders the only `h1`, each band an `h2`, each card an `h3`, and the bands alternate tone so the
eye can tell where one chapter ends. The patterns manage heading levels for you; the page's job is to stay
out of their way and keep eyebrows, titles and leads consistent.

## Why

- **The outline is the page for assistive tech and search**: the demos once shipped with no `h1` and with
  eight. `packages/ui/src/patterns/outline.test.tsx` now guards the library; your page needs its own test.
- **Rhythm is what makes a long page scannable**: a run of same-tone bands reads as one undifferentiated
  wall.
- **Consistency is most of polish**: one band without an eyebrow, or one centred header among start-aligned
  ones, is what a reviewer notices first.

## Pattern

```tsx
// Bad: hand-placed levels, and a wrapper that resets the outline
<HeadingScope level={2}>
	<MarketingSection><Heading level={3}>Pricing</Heading></MarketingSection>
</HeadingScope>

// Good: the hero is h1, every band publishes h2, Feature.Grid and Bento make their titles h3
<LandingHero title="Know your site is up before your users do" … />
<MarketingSection tone="tinted">
	<MarketingHeader eyebrow="Features" description="…">Everything you check by hand</MarketingHeader>
	<Feature.Grid columns={3}>…</Feature.Grid>
</MarketingSection>
```

A custom wrapper that is not a section (`Rails`, a plain `div` holding a chapter) publishes no level;
wrap it once in `HeadingScope level={2}` or its titles fall back to `h1`.

## Bands

- **Tones** alternate: `plain` / `tinted`, with `brand`, `inverse` or `gradient` for one or two emphasis
  bands. `inset` floats a toned band with rounded corners; use `ruled` between two bands of the same tone.
- **Spacing**: `spacing="compact"` for proof strips and try-it forms, default for chapters, `hero` and `cta`
  for the ends. The spacing tokens (`--ui-marketing-section-space`, `-compact`, `-hero`, `-cta`) already scale
  with the viewport; do not add padding of your own.
- **Every band has an eyebrow**, in one style for the whole page (`mono` uppercase is the default
  marketing look; `pill` suits a hero; `numbered` suits chapters).
- **Chapter titles** stay at 32 characters or fewer, sentence case, never Title Case.
- **Leads** carry at most one `<strong>`, which draws in heading ink.
- **Alignment**: headers start-aligned throughout; only hero variants, closing bands and try-it bands are
  centred. Never mix alignments inside one band (start-aligned figures under a centred heading).
- **Big grids** use `MarketingHeader layout="split"` so the title sits beside the lead instead of above a
  wall of cards.

## Typography

The display and chapter scales come from `--ui-marketing-display-*` and `--ui-marketing-chapter-*` in
`packages/ui/src/theme.css`, which is the source of truth (the catalogue's markdown lists older fixed
values). Card titles get `text-wrap: balance` and body notes `pretty`. Hero lead is 20–24px on desktop in
`neutral` (not muted), about 17px on phones.

## Rules

1. One `h1` from the hero; never place heading levels by hand inside bands.
2. Wrap a non-section chapter wrapper in exactly one `HeadingScope level={2}`.
3. Alternate band tones; separate same-tone neighbours with `ruled`.
4. Give every band an eyebrow in one style, a title of 32 characters or fewer, and a lead with at most one
   `<strong>`.
5. Start-align headers except the hero, try-it and closing bands.
6. Add a server-render outline test: one `h1`, first, and no skipped levels.
