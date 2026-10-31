---
title: Gotchas
impact: MEDIUM
tags: [gotchas, css-layers, islands, ids, i18n]
---

# Gotchas

The things that broke real pages and cost hours to find. Each one fails silently.

## Two mixins setting the same property

Every `css()` call and utility is its own cascade layer, ordered by first use on the page. Two mixins that
set the same property on one element resolve by page order, not by which you wrote last.

```tsx
// Bad: which padding wins depends on what rendered first elsewhere
mix={[p(4), raw({ padding: "2rem" })]}

// Good: one source per property; compute the value, or route it through a custom property
mix={[raw({ padding: wide ? "2rem" : "1rem" })]}
```

Theme tokens are unlayered on `:root`, so a band-level `--ui-*` override only applies in light mode unless
the band also re-declares it for dark.

## DialogDismiss needs its island registered

`DialogDismiss` (the phone menu closing when a link is tapped) is a client island keyed on
`@sdxc/ui/dialog-dismiss`. Map it in the app's `bootstrap/browser.ts`:

```ts
"@sdxc/ui/dialog-dismiss": () => import("@sdxc/ui/dialog-dismiss"),
```

Without it the sheet stays open after following `/#pricing`. Copy the sheet-close test from
`apps/sdxc-site/resources/views/demos/headers.browser.test.tsx`.

## Ids and radio names

`SiteHeader` seeds its sheet and panel ids from `id`; pass a stable one so markup is byte-identical across
renders. `CodeStage`, `TabbedStage`, `SegmentedStage` and `InstallTabs` switch with radio groups: each needs
a page-unique `name`, or two switchers control each other. The last three also require an `aria-label`.

## Card media disappears on phones

`Bento.Media` and `Feature.Media` are hidden below the `md` container, because a phone has no room for a
scene beside the copy. A bento or feature grid is text cards at 375. Keep the claims a phone reader must
see in the hero and the split bands, whose media always shows, and write card copy that stands on its own.

## English defaults

`SiteHeader` (`navLabel`, `menuLabel`, `closeLabel`), `SiteFooter` (`label`), `Marquee` and `MotionLoop`
(`pauseLabel`) default to English. Pass translated values in a localized app. Raw keys such as
`landing.comparison.title` on screen mean a key was nested under the wrong parent; add a test that scans the
render for `landing.` text.

## Heading levels in custom wrappers

Only sections publish a heading level. Titles inside `Rails` or a plain `div` fall back to `h1` unless the
wrapper sits in `HeadingScope level={2}`. Never wrap a `MarketingSection` in a `HeadingScope`.

## Overflow at 320px

The usual causes: a flex child without `min-inline-size: 0`, long inline code, a long filename in a code
tab, a hit-area `::after` on a static element, and corner ticks cut by `overflow: clip`. Give truncating
text `min-inline-size: 0` and its sibling button `flex-shrink: 0`.

## Feature cards

`Feature href` only marks the card; the link is a `Feature.Link` inside `Feature.Action`. `Feature
variant="panel"` belongs outside a `Feature.Grid`, which draws its own card chrome.

## Stale dev server

After renaming or moving a controller, touch the router initializer or the dev server serves stale SSR.
Add a cache-busting query when the browser pane disagrees with curl.

## Rules

1. Give each CSS property one source per element.
2. Register `@sdxc/ui/dialog-dismiss` in `bootstrap/browser.ts` whenever the header has a sheet.
3. Use stable ids and page-unique radio names.
4. Pass translated labels for every English default.
5. Scope non-section chapter wrappers with `HeadingScope level={2}`.
