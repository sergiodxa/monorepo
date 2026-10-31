---
title: Story and Section Order
impact: CRITICAL
tags: [structure, copy, page-kinds]
---

# Story and Section Order

Decide what the page argues before choosing components. A landing is a sequence: promise, proof, how it
works, what it costs, one next step. The page kinds below are the orders that survived review; start from
the closest one and change it only for a reason you can name.

## Why

- **Readers skim in order**: the hero and the first band decide whether anyone scrolls.
- **Sameness kills a family of pages**: three demos sharing one skeleton read as a template. Each page kind
  gets its own order, and each product its own art direction.
- **The order exposes gaps**: if you cannot fill "how it works" with something visual, the product story is
  not ready yet, and no component will fix that.

Write the story first (@rules/copy-with-taste.md); each proof in it becomes a band, and each band gets a
visual chosen by @rules/choose-the-visual-device.md. The orders below are where those bands go.

## Orders by page kind

**Product home** (`apps/uptime/app/http/controllers/home.tsx`)

1. `LandingHero` (`entrance`, `mediaPlacement="end"`, pill eyebrow, `AccentText` in the title) with an
   inline product mockup, CTAs, and a horizontal `CheckList` of trust lines.
2. Compact band with `StatStrip size="display" variant="gap"` — four real figures.
3. Try-it form in a tinted inset compact band, when the product can be tried without signing up.
4. Benefits as `Feature.Grid variant="list"` (uncarded, icons).
5. Linked feature cards, every one with a `Feature.Media` scene, nine in a 3×3.
6. Split bands (`FeatureBand layout="split" lean="media"`) for the API, the workflow, the differentiator,
   each with a `CodeStage`, `FlowDiagram` or mockup.
7. Use cases as linked cards plus a row of `LinkButton variant="surface"` audience links.
8. Pricing, FAQ (`FaqBand columns={2}`), closing band.

**Feature page** (`apps/uptime/app/http/controllers/marketing-feature.tsx`)

Tinted hero with a mockup of that feature → `StatStrip` only when all four values are real → cards with
brand icons → `#how-it-works` split with `StepList variant="timeline"` beside a visual that is not the
hero's → FAQ → closing band.

**Audience or use case** (`apps/uptime/resources/views/marketing/solution.tsx`)

Hero with mockup → figures → capabilities as a linked `Feature.Grid variant="list"` → spotlight split with
a scene that differs from the hero → steps (`FeatureBand layout="steps"`) → FAQ → closing band. Flip band tones when an optional section
is absent so plain and tinted keep alternating.

**Comparison** (`apps/uptime/app/http/controllers/marketing-comparison.tsx`)

Centred hero, media capped at 40rem, primary CTA plus an outline "Compare costs" link → honest table
(our column in `brand`, labels in `neutral.emphasis`, cells left-aligned) → reasons to switch (uncarded
list) → an honest "where they win" list with a warning icon → "perfect for" inset strip → cost table from
the pricing config → split steps with a scene → FAQ → links to the other comparisons → closing band.
Never repeat the `h1` as the table heading.

**Standalone product page** (`apps/uptime/app/http/controllers/browser-flows.tsx`, `mcp.tsx`)

`/browser-flows`: hero with the flow monitor's own screen (`ProductMockup area="flow"`) → a `CodeStage` of
three example specs over cards naming each → "HTTP vs browser" list → pricing figures → split steps
beside a `TypedTerminal` of the spec → FAQ → closing band. `/mcp` is shorter: a `CodeStage` hero of the client config →
the tools as a split beside the API-keys mockup → steps → closing band.

**SaaS landing** (`apps/sdxc-site/resources/views/demos/saas/sections.tsx`)

Hero (`mediaPlacement="below"`, `tone="grid"`, `release` pin) with a `SegmentedStage` of product screens →
ruled logo cloud → `01 / Metering` chapter in `Rails` with code tabs → four display figures → `02 /
Workflow` `TabbedStage` on an inverse band → `03 / Platform` `Bento` → `04 / Security` uncarded list →
`ChangelogStrip` → `05 / Customers` testimonials → `06 / Pricing` → `07 / FAQ` → `ClosingCta`.

**Book** (`apps/sdxc-site/resources/views/demos/book/index.tsx`)

Hero with the flat cover (`mediaPlacement="end"`) → press line (`LogoSentence`, only if real) → the free
chapter as a split with a sample page → `Curriculum` contents → what you will learn → figures (readers,
rating, pages, video hours) → `AuthorBand` → reviews (only if real) → `PricingBand columns={2}` → FAQ →
`ClosingCta`. Editorial direction: serif display, flat surfaces, quiet radii, generous measure.

**Consumer app** (`apps/sdxc-site/resources/views/demos/app/index.tsx`)

Centred hero with a hand-drawn phone (`FannedPhone`) and a `below` marquee → `TabbedStage` tour of screens → stories →
`Bento` of colour-block scenes → privacy (inverse inset) → platforms and figures → pricing → FAQ →
download band.

**Developer tool home** (`apps/sdxc-site/resources/content/home.md`)

Split hero with the install command and a `CodeStage` showcase bleeding off the end → four counted
figures → thesis statement band → code tabs → principles grid → package groups → three featured packages
→ "Versions are dates" → sponsors → centred `tone="grid"` closing.

**Trial or tool page** (`apps/uptime/app/http/controllers/trial/index.tsx`)

The first screen is the form and nothing else; selling bands appear after the tool runs.

**Long policy or prose page** (`apps/uptime/app/http/controllers/trust.tsx`)

Centred hero, three cards, a grid band, the policy as a `Typeset` article at about a 720px measure,
closing band.

**Long-form reading view** (a free chapter, an article behind a form)

Not a landing, but it belongs to one: `Typeset preset="reading"` at a 65–75 character measure, a quiet
header with the way back, headings and code blocks styled by the same tokens as the landing, an optional
"On this page" rail on wide screens, and the landing's closing band at the end so the reader has the next
step.

**Docs hub** (`apps/sdxc-site/app/http/controllers/docs-index.tsx`)

`PageTitle`, then "start here" cards with the CTA pinned to the card foot, then guides grouped by section
in two columns.

## Families of pages

When a site has many pages of one kind (features, audiences, comparisons, books), make one template and
feed it typed records:

```ts
// resources/content/marketing.ts
export const features: Record<string, MarketingContent.Page> = {
	"ssl-monitoring": { title: "…", highlight: "…", features: [{ icon: "lock", … }], steps: […], faqs: […] },
};
```

The controller looks up `records[slug]` and renders the template, or a 404 on a miss. Per-slug choices
that are visual (which mockup, which spotlight scene) live in maps beside the mockups, and a test asserts
every map covers every record.

## Rules

1. Write the story before any JSX.
2. Start from the closest page kind's order; change it only for a stated reason.
3. Give each product its own order and art direction instead of reusing another page's skeleton.
4. A family of pages is one template plus typed records keyed by slug.
5. End every page on one closing band with the same primary CTA as the hero and header.
