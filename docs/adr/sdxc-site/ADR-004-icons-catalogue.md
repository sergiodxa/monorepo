# ADR-004: An Icon Catalogue for `@sdxc/icons`

## Status

**Proposed** - 2026-11-02

## Background

`/api/icons` renders the `@sdxc/icons` README, which explains the naming rule and sends the
reader to [lucide.dev/icons](https://lucide.dev/icons/) to find an icon. Finding one means
leaving the site, searching Lucide's catalogue, and translating the kebab-case name into the
export (`circle-alert` → `CircleAlertIcon`) by hand.

The package wraps about 1,760 Lucide icons. That is the same situation `@sdxc/u` and
`@sdxc/ui` were in, and the route table already answers it: a README that indexes hundreds of
entries is a site, so a catalogue package answers on its own tree.

## Context

### What the package ships

| Source                | What it holds                                                   |
| --------------------- | --------------------------------------------------------------- |
| `src/registry.ts`     | Every icon's node tuples, one named export per icon             |
| `src/icon-names.ts`   | Kebab-case name → registry export name                          |
| `src/index.ts`        | One `<PascalCase>Icon` component per icon, plus `<Icon name />` |
| `lucide-static` (dev) | `icon-nodes.json`, `tags.json` and `sprite.svg`, for `generate` |

`lucide-static` carries tags but no categories. Lucide keeps categories only in its own
repository, so the catalogue works from what the installed package already provides: names,
tags and node tuples.

### Constraints

- The browser must not download icon components. A page rendering every icon through
  `@sdxc/icons` on the client would ship the whole registry.
- The icons are Lucide's work. The page must say so prominently and route readers to Lucide's
  own docs and to [lucide.dev/sponsor](https://lucide.dev/sponsor), so it never reads as a
  catalogue of original icons.
- Every page on the site works without script and has a markdown twin (ADR-003 and the
  `markdown.*` routes).

## Decision

### Routes

```typescript
api: {
	index: get("/api"),
	utility: get("/api/u/:utility"),
	component: get("/api/ui/:component"),
	uiExport: get("/api/ui/:subpath/:slug"),
	/** The icon gallery, filtered by `?q=`. */
	icons: get("/api/icons"),
	/** One icon: large preview, both JSX forms and its tags. */
	icon: get("/api/icons/:icon"),
	show: get("/api/:name"),
},
markdown: {
	icon: get("/api/icons/:icon.md"),
},
frames: {
	/** The body of one icon's page, loaded into the gallery's detail dialog. */
	icon: get("/frames/icons/:icon"),
},
/** Every icon as a `<symbol>`, requested as `?v=<Lucide version>` and cached immutably. */
iconSprite: get("/api/icons/sprite.svg"),
```

`icons` and `icon` sit before `show`, so `/api/icons` stops falling through to the README.
`/api/icons.md` keeps serving the README, which stays the package's prose reference. The
sprite route is declared before `icon` so `sprite.svg` never matches `:icon`.

### The gallery is server HTML over one sprite

Each tile is a link wrapping a sprite reference:

```tsx
<a
	href={routes.api.icon.href({ icon: "heart" })}
	data-rmx-target="icon"
	data-rmx-src={routes.frames.icon.href({ icon: "heart" })}
	data-search="heart like love"
>
	<svg aria-hidden="true">
		<use href={`${routes.iconSprite.href()}?v=${LUCIDE_VERSION}#heart`} />
	</svg>
	<span>heart</span>
</a>
```

A tile costs about 100 bytes, so the full grid stays around 170 KB before compression, and
the sprite downloads once and is cached. The sprite is built on the server from `registry.ts`
through the same node tuples the components render, so the gallery and the package can never
draw an icon differently. No icon component reaches the browser.

Tiles form one alphabetical grid, each icon once.

### The sprite is cached once per version

Every reference to the sprite carries `?v=`, and the version changes whenever the icons do,
so a new set of icons is a new URL and nothing has to be purged.

The version is the Lucide release the registry was generated from. `generate-icons.ts` reads
it from `lucide-static`'s `package.json` and writes it into the package as
`export const LUCIDE_VERSION = "1.61.0"`, which the site imports. The icon data in the
registry changes only when `generate` runs against a new `lucide-static`, so this version
changes exactly when the sprite's content does. The package's own `package.json` version is
the `0.0.1` placeholder in the repository, and its dated release version exists only in the
published manifest, so neither can key the sprite.

The sprite controller answers in one of two ways:

| Request                       | `Cache-Control`                       |
| ----------------------------- | ------------------------------------- |
| `?v=` equals `LUCIDE_VERSION` | `public, max-age=31536000, immutable` |
| `?v=` missing or any other    | `public, max-age=3600`                |

Only the exact version is immutable. A page cached from before an upgrade still asks for its
old version and receives the current sprite, but on the short policy, so an old URL can never
be pinned to new content. The controller stores every immutable response in the edge cache
(`caches.default`), keyed by the full URL, so the CDN draws the sprite once per version per
location. Browsers keep it for a year without revalidating. The sprite is built from the
registry on the first request for each version, never at module scope.

### Customizer

Size, color, stroke width and absolute stroke width are CSS custom properties on the grid.
`<use>` inherits `color`, `stroke` and `stroke-width` into the symbol, so one small mixin
writing those properties restyles every tile at once. The detail view's JSX snippet reflects
the current values (`<HeartIcon size={32} strokeWidth={1.5} aria-hidden />`), and the values
live in the query string so a customized gallery has its own address.

### Filter

A plain `GET` form submits `?q=`, matched against names and tags, and the server renders only the matching
tiles, so filtering works without script and a result set can be linked. Once script runs, a
mixin hides non-matching tiles on input by testing `data-search` (the name plus its tags), and
keeps the query string in step with `history.replaceState`.

### One detail dialog, one named frame

The gallery renders a single `<dialog>` holding `<Frame name="icon">`. Every tile is a
named-frame link: `data-rmx-target="icon"` loads `data-rmx-src` into that frame while `href`
stays the browser's destination. A delegated click handler on the grid calls `showModal()`.
Without script, a tile is a plain link to `/api/icons/:icon`.

The dialog and the icon page share one component, so they show the same content:

- the icon at a large size on a pixel grid, the name and its tags;
- both ways to render it, each with a copy button:
  `<HeartIcon aria-hidden />` and `<Icon name="heart" aria-hidden />`;
- the import line, `import { HeartIcon } from "@sdxc/icons";`;
- a copy-SVG button and a link to the icon's page on lucide.dev.

### Attribution

The gallery opens with a credit band above the filter, never in the footer: the icons are
[Lucide](https://lucide.dev), made by the Lucide contributors under the ISC license, with
links to Lucide's docs and to [lucide.dev/sponsor](https://lucide.dev/sponsor). Every icon
page and dialog links its icon on lucide.dev. `@sdxc/icons` is described as a
`remix/component` packaging of Lucide's icons.

### Tags come from `lucide-static` at generate time

`scripts/generate-icons.ts` copies `lucide-static`'s `tags.json` into `src/icon-tags.ts`,
exported from its own entry point as `@sdxc/icons/tags` so an app importing components never
loads the tag data. It writes `LUCIDE_VERSION` into `icon-names.ts`, exported from
`@sdxc/icons`. Generation stays offline and pinned to the installed version, and a test fails
when `LUCIDE_VERSION` differs from the installed `lucide-static`, so a dependency bump without
a regenerate never ships.

## Consequences

### Positive

- **Finding an icon stays on the site** - search by name or tag, copy the JSX.
- **No icon JavaScript in the browser** - the grid is HTML plus one cached sprite; the only
  client code is the filter, customizer and dialog mixins.
- **The sprite invalidates itself** - a Lucide upgrade changes `?v=`, so the CDN and browsers
  fetch the new sprite once and keep it until the next upgrade.
- **Every view has an address** - filters and customizer values are in the query string, and
  every icon has its own page and markdown twin.
- **Lucide is credited where readers look** - at the top of the gallery and on every icon.

### Negative

- **No browsing by category** - readers find icons by name or tag only, until a category
  source ships in a package the repo already installs.
- **A large page** - the gallery is one long document. Compression keeps it small on the
  wire, but layout covers every tile.
- **The package grows a data entry point** - `@sdxc/icons/tags` adds about 280 KB of source
  to the published package, loaded only by code that imports it.

### Neutral

- **The README stays** - `/api/icons.md` and npm keep the prose reference, and the gallery
  links to it for props and accessibility guidance.

## Alternatives Considered

### 1. One frame per tile

Each tile as its own `LazyFrame`, loading as it nears the viewport.

**Rejected because**: about 1,760 requests for content smaller than the request headers. Splitting
the grid into a few alphabetical `LazyFrame` sections stays available if the single document
proves slow to lay out.

### 2. One `LazyFrame` dialog per icon

Each tile with its own `<dialog>` and `LazyFrame loadOn="open"`.

**Rejected because**: `LazyFrame` loads one fixed `src`, so this needs 1,760 dialogs in the
document. One dialog with a named frame serves every icon.

### 3. Inline SVG per tile

Rendering each icon's paths into its tile.

**Rejected because**: it puts every path in the document on every visit; the sprite holds
each path once and is cached across visits.

### 4. Categories fetched from Lucide's repository

Grouping tiles under Lucide's categories, fetched by `generate-icons.ts` from Lucide's
repository at the tag matching `lucide-static`.

**Deferred because**: it makes generation depend on the network and a second source. The
gallery adds categories once a package the repo already installs ships them.

### 5. Hydrated grid

A client component rendering tiles from a JSON list.

**Rejected because**: it ships the registry to the browser and leaves the page empty without
script.

## Implementation Plan

### Phase 1: Package data

1. Upgrade the registry to the installed Lucide 1.61.0, renaming the removed icons in apps
2. Extend `generate-icons.ts` to write `icon-tags.ts` and `LUCIDE_VERSION`
3. Export `LUCIDE_VERSION` from `@sdxc/icons` and `iconTags` from `@sdxc/icons/tags`

### Phase 2: Gallery and icon pages

1. Add the routes, the sprite controller and the shared icon detail component
2. Render the gallery with the credit band and the `GET` filter
3. Add the markdown twin and sitemap entries for icon pages

### Phase 3: Enhancements

1. Filter mixin over `data-search`
2. Customizer mixin over CSS custom properties
3. Detail dialog with the named frame and copy buttons

## References

- [Lucide icons](https://lucide.dev/icons/)
- [Sponsor Lucide](https://lucide.dev/sponsor)
- [ADR-003: One Route Serves a Resource in Every Format](./ADR-003-format-extension-on-one-route.md)
- Named-frame links: `docs/vendor/@remix-run/component/docs/frames.md`

## Current Progress

- [x] Phase 1: Package data
- [x] Phase 2: Gallery and icon pages
- [ ] Phase 3: Enhancements

## Notes

- The gallery replaces the README's HTML page at `/api/icons`; the README stays at
  `/api/icons.md` and on npm, and the gallery's Usage section links to it for props.
- Icon pages stay out of `listCataloguePages`, so search, `/llms.txt` and the MCP resources
  list the package once rather than 1,903 icon pages; the sitemap lists every icon page.
- A frame route returns its render as streamed, so `/frames/icons/:icon` skips
  `withBundleCache`.
