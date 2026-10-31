# ADR-185: Landing Components Stay in `@sdxc/ui/patterns`

## Status

**Accepted** - 2026-10-31

## Background

`@sdxc/ui` publishes its landing-page bands and composition craft (`LandingHero`, `SiteHeader`,
`Bento`, `ClosingCta`, `MotionLoop`, …) from `@sdxc/ui/patterns`, and the band primitives
(`MarketingSection`, `MarketingHeader`, `StatStrip`, `LogoCloud`, `Feature`) from the root
catalog. Apps built on them grew their own generic pieces, and moving those upstream raised the
question of a separate `@sdxc/ui/marketing` entry point for every landing piece.

## Context

- A new entry point would rename the import of every landing piece in every app and break every
  published consumer, for no change in what the components do.
- `@sdxc/ui/patterns` already exists to keep landing weight off the root catalog, and its guide
  and catalogue pages group its modules as marketing.
- An agent proposed the `./marketing` entry, and the user corrected it: landing pieces go
  alongside the existing landing components.

## Decision

1. Landing bands and composition craft live in `src/patterns/` and ship from
   `@sdxc/ui/patterns`. Band primitives stay on the root catalog.
2. `@sdxc/ui` adds no audience-named entry point (`./marketing`, `./landing`). A new landing
   piece joins `patterns`, or the root catalog when it is a primitive.
3. A client island a page drops into any modal, such as `DialogDismiss`, sits on the root
   catalog with its own `@sdxc/ui/<name>` subpath, so the browser entry imports one module.

## Consequences

- Upstreaming a piece from an app is additive: existing imports keep working.
- An app using a package island registers its subpath in its browser entry's module map.
