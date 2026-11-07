# ADR-009: Shared Pieces for the App Pages

## Status

**Accepted** - 2026-11-07

## Background

The blog hosts each iOS app's marketing, privacy and support pages under `/apps/<app>/`, each
app in its own look on a shell of its own. Wakaba's pages came first. Encore's followed and
needed the same phone frame, guided tour, swipeable row, App Store badge, footer and support
form. The first extraction kept Wakaba's colour names and aliased them for the shared code
(`--app-card: var(--wakaba-card)`), so shared code still depended on one app's names.

## Decision

The pieces every app page uses live once in `apps/blog/resources/views/app-pages/`:
`phone.tsx`, `guided-tour.tsx`, `swipeable.tsx`, `app-store-badge.tsx`, `footer.tsx` and
`support-form.tsx`. They stay in the blog, not in `packages/*`, because only these pages use
them.

Shared code paints with app-neutral tokens and never names an app:

| Token          | Paints                                       |
| -------------- | -------------------------------------------- |
| `--app-card`   | cards: the support form, the policy, the FAQ |
| `--app-stage`  | the panel behind a tour step's screen        |
| `--app-accent` | the tour's active dot and progress line      |
| `--app-rail`   | the tour's rail                              |
| `--app-bezel`  | the phone frame                              |

Each app's stylesheet (`resources/css/<app>.css`, scoped by the `<app>` class on `<html>`)
sets these values directly, light and dark, and its own views use them as well. App-specific
tokens (`--wakaba-kitsune`, `--encore-card-face`) exist only for things one app draws.

With a listing, the download call is Apple's official "Download on the App Store" badge,
unaltered and in the page's language, as Apple's identity guidelines require. The artwork is
served from `public/apps/app-store/`. Before release it is a plain "Coming soon" note.

## Consequences

- A new app page sets the five `--app-*` tokens in its stylesheet and gets the shared pieces
  with no aliases.
- Renaming or restyling a shared piece is one change that every app page picks up; each app's
  pages are rechecked when that happens.
- The badge files must exist before an app with a listing goes live; until then its pages
  show broken images.
