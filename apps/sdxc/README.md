# sdxc

Documentation and marketing site for the published `@sdxc/*` packages: what the collection
is, why the packages look alike, and which one to reach for.

Production URL: https://sdxc.sergiodxa.com

## Development

1. Copy `.env.example` to `.dev.vars` for local development
2. Run `bun run dev` to start the development server at http://localhost:3007

## Cloudflare Services

Configured in `cloudflare.config.ts` and deployed with the `cf` CLI.

- **KV** (`CACHE`) holds what the site reads back from GitHub: the changelog and the
  sponsor list. Every other page renders from files in the deployed bundle.
- **Cron** (`0 */6 * * *`) refreshes the sponsor list into KV, so a page never waits on
  GitHub.
- **Custom domain** `sdxc.sergiodxa.com`.

Observability is enabled, with traces head-sampled at 10%.

## Features

- **The landing page is a markdown file.** `resources/content/home.md` holds the whole
  pitch, written in a small tag vocabulary — `hero`, `section-block`, `split`, `stats`,
  `actions`, `feature-grid`, `code-tabs`, `package-groups`, `note` — whose components live
  in `resources/components/`. Editing the copy is editing that one file.
- **Every band sits in one frame.** Each section draws a rule across the page, dashed rails
  down both sides of the content column and a marker where they meet, so the page reads as
  one frame the sections are set into. The frame is `resources/components/band.tsx`.
- **Every tag has an attribute schema**, so a mistyped attribute is a parse error
  carrying the line it sits on rather than a section that renders blank.
- **The package list comes from the workspace.** Names and descriptions are read from
  `packages/*/package.json` at build time and grouped by the taxonomy in
  `resources/content/groups.ts`, so a newly published package appears here the day it
  ships and a stale description is impossible.
- **The counts are counted.** `{% $packageCount %}` and its siblings resolve from the
  same manifests, so a sentence about the collection cannot drift from it.
- **Code blocks are highlighted server-side** by the `@sdxc/highlight` walk visitor,
  which returns tokens rather than markup.
- **Almost no first-party JavaScript.** Pages are server-rendered HTML; the tab strip is
  CSS-only and the sidebar collapses through a checkbox, so the islands are the copy button,
  which needs script to reach the clipboard, the package palette, which needs it to filter,
  and the option-group sync, which records a switch and carries it to the other strips on the
  page.
- **A tab strip can name the choice it offers.** Every strip naming the same group — the
  install commands all name `package-manager` — shares one selection, kept in a single cookie
  and read while the page renders, so the manager a reader picked is the one the server draws
  and nothing changes under them after hydration. A strip that names no group is remembered
  nowhere, because two sets of samples are rarely the same question asked twice.
- **Guides are markdown with validated frontmatter.** `resources/docs/**/*.md` carry a
  `title`, `description`, `section` and `order`, which is what the `/docs` sidebar and the
  hub are built from — no page lists another page by hand.
- **A package's reference is its own README.** The same file npm and GitHub show, with
  its links rewritten to site URLs, framed by the install line, subpath exports,
  dependencies and the applications that depend on it, all read from manifests.
- **Documentation pages are cached.** Every input to one is a file in the bundle, so a
  page carries a long `Cache-Control` and a weak `ETag` over the bytes rendered, and a
  client whose copy is current gets a `304`.

## Routes

| Route                           | Description                                            |
| ------------------------------- | ------------------------------------------------------ |
| `/`                             | The landing page                                       |
| `/docs`                         | The guides hub, routing a reader by intent             |
| `/docs/<slug>`                  | One handwritten guide from `resources/docs`            |
| `/api`                          | Every published package, grouped and filterable        |
| `/api/:name`                    | One package's README, framed by its manifest's facts   |
| `/api/u`, `/api/u/:utility`     | The `@sdxc/u` catalogue and one utility's reference    |
| `/api/ui`, `/api/ui/:component` | The `@sdxc/ui` catalogue and one component's reference |
| `/api/ui/:subpath/:slug`        | One mixin, behavior, animation or style recipe         |
| `/docs/packages/*`              | Permanent redirects to the same path under `/api`      |

Each part draws its own sidebar: the guides under `/docs`, every package but the two
catalogues under `/api`, and one each for `@sdxc/u` and `@sdxc/ui` under their own paths.
The pager steps only through the sidebar of the page being read.

## Scripts

| Script       | Description                               |
| ------------ | ----------------------------------------- |
| `dev`        | Start development server                  |
| `build`      | Build for production                      |
| `start`      | Preview the production build              |
| `cf:deploy`  | Deploy to Cloudflare                      |
| `cf:typegen` | Regenerate `.cloudflare/types/index.d.ts` |
| `typecheck`  | Type check the app with `tsc`             |

## Deployment

```bash
bun run cf:deploy
```

## Environment Variables

See `.env.example`.
