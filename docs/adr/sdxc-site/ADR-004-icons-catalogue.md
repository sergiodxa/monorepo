# ADR-004: An Icon Catalogue for `@sdxc/icons`

## Status

**Implemented** - 2026-11-04

## Background

`/api/icons` renders the `@sdxc/icons` README, which explains the naming rule and sends the
reader to [lucide.dev/icons](https://lucide.dev/icons/) to find an icon. Finding one means
leaving the site, searching Lucide's catalogue, and translating the kebab-case name into the
export (`circle-alert` → `CircleAlertIcon`) by hand.

The package wraps 1,903 Lucide icons. That is the same situation `@sdxc/u` and
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
```

`icons` and `icon` sit before `show`, so `/api/icons` stops falling through to the README.
`/api/icons.md` keeps serving the README, which stays the package's prose reference.

### The gallery is server HTML over symbols in the page

The gallery renders every icon once as a `<symbol>` in one hidden `<svg>`, and each tile is a
link wrapping a `<use>` that names its symbol:

```tsx
<a href={routes.api.icon.href({ icon: "heart" })} data-search="heart like love">
	<svg aria-hidden="true">
		<use href="#lucide-heart" />
	</svg>
	<span>heart</span>
</a>
```

Each symbol holds the icon as its component renders it, so the gallery and the package can
never draw an icon differently, and no icon component reaches the browser. Symbol ids carry a
`lucide-` prefix, so an icon called `search` or `menu` never collides with an id the page
already uses. The page needs no request beyond its own HTML, and the HTML is cached like every
docs page: an hour at the edge, revalidated by its ETag.

Tiles form one alphabetical grid, each icon once.

### The Lucide version the package exports

`generate-icons.ts` reads the Lucide release from `lucide-static`'s `package.json` and writes it
into the package as `export const LUCIDE_VERSION = "1.61.0"`. The gallery names it in its count,
and it can key a cache of anything drawn from the icons. The package's own `package.json`
version is the `0.0.1` placeholder in the repository, and its dated release version exists only
in the published manifest, so neither can name the icons' release.

### Customizer

Size, color, stroke width and absolute stroke width are CSS custom properties on the grid.
`<use>` inherits `color`, `stroke` and `stroke-width` into the symbol, so one small mixin
writing those properties restyles every tile at once. The detail view's JSX snippet reflects
the current values (`<HeartIcon size={32} strokeWidth={1.5} aria-hidden="true" />`), and the values
live in the query string so a customized gallery has its own address.

### Filter

The filter and the customizer are one `GET` form, so a narrowed or restyled grid has its own
address and works without script. The server renders every tile and marks the ones `?q=`
leaves out `hidden`, matching every word against the icon's name and tags. Once script runs,
an island toggles `hidden` as the reader types, by the same rule the server applies, and keeps
the query string in step with `history.replaceState`.

### One detail dialog

The gallery renders a single `<dialog>`. A plain click on a tile opens it and mounts a
`<Frame>` for `/frames/icons/:icon`, carrying the customization in the address; a click with a
modifier, a middle click, or a browser without script follows the tile to `/api/icons/:icon`.
Resting the mouse or focus on a tile, or pressing it, fetches its detail ahead, so the dialog
opens with its content. A press on the backdrop closes it.

The dialog and the icon page share one component, so they show the same content:

- the icon at a large size on Lucide's 24-unit grid, with its tags beside it;
- both ways to render it, each with a copy button:
  `<HeartIcon aria-hidden="true" />` and `<Icon name="heart" aria-hidden="true" />`;
- the import line, `import { HeartIcon } from "@sdxc/icons";`;
- its SVG source and a link to the icon's page on lucide.dev.

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
- **No icon JavaScript in the browser** - the grid is HTML and symbols in the same page; the only
  client code is the filter, customizer and dialog mixins.
- **One request in every engine** - the symbols arrive with the page, so a cold load never
  waits on a second file.
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

**Rejected because**: about 1,900 requests for content smaller than the request headers. Splitting
the grid into a few alphabetical `LazyFrame` sections stays available if the single document
proves slow to lay out.

### 2. One `LazyFrame` dialog per icon

Each tile with its own `<dialog>` and `LazyFrame loadOn="open"`.

**Rejected because**: `LazyFrame` loads one fixed `src`, so this needs about 1,900 dialogs in the
document. One dialog that mounts a frame for the clicked tile serves every icon.

### 3. Inline SVG per tile

Rendering each icon's paths into its tile.

**Rejected because**: it repeats every path in the document for each tile that draws it; the
page's symbols hold each path once.

### 4. Categories fetched from Lucide's repository

Grouping tiles under Lucide's categories, fetched by `generate-icons.ts` from Lucide's
repository at the tag matching `lucide-static`.

**Deferred because**: it makes generation depend on the network and a second source. The
gallery adds categories once a package the repo already installs ships them.

### 5. Hydrated grid

A client component rendering tiles from a JSON list.

**Rejected because**: it ships the registry to the browser and leaves the page empty without
script.

### 6. A versioned external sprite

Every symbol in `/api/icons/sprite.svg?v=<Lucide version>`, cached immutably by browsers and
the edge, with tiles drawing `<use href="/api/icons/sprite.svg?v=1.61.0#heart">`.

**Rejected because**: on sdxc.dev a cold load downloaded the whole sprite once per tile, since
an engine may fetch an external `<use>` file once per element while the first fetch is in
flight. A `<link rel="preload">` cannot warm it: Chromium matches no `as` value to a `<use>`
load, and fetched the sprite twice with every combination of `as` and `crossorigin` tried.

## Implementation Plan

### Phase 1: Package data

1. Upgrade the registry to the installed Lucide 1.61.0, renaming the removed icons in apps
2. Extend `generate-icons.ts` to write `icon-tags.ts` and `LUCIDE_VERSION`
3. Export `LUCIDE_VERSION` from `@sdxc/icons` and `iconTags` from `@sdxc/icons/tags`

### Phase 2: Gallery and icon pages

1. Add the routes and the shared icon detail component
2. Render the gallery with the credit band and the `GET` filter
3. Add the markdown twin and sitemap entries for icon pages

### Phase 3: Enhancements

1. Filter mixin over `data-search`
2. Customizer mixin over CSS custom properties
3. Detail dialog with a frame per opened icon, and copy buttons

## References

- [Lucide icons](https://lucide.dev/icons/)
- [Sponsor Lucide](https://lucide.dev/sponsor)
- [ADR-003: One Route Serves a Resource in Every Format](./ADR-003-format-extension-on-one-route.md)
- Named-frame links: `docs/vendor/@remix-run/component/docs/frames.md`

## Current Progress

- [x] Phase 1: Package data
- [x] Phase 2: Gallery and icon pages
- [x] Phase 3: Enhancements

## Notes

- The gallery replaces the README's HTML page at `/api/icons`; the README stays at
  `/api/icons.md` and on npm, and the gallery's Usage section links to it for props.
- Icon pages stay out of `listCataloguePages`, so search, `/llms.txt` and the MCP resources
  list the package once rather than 1,903 icon pages; the sitemap lists every icon page.
- A frame route returns its render as streamed, so `/frames/icons/:icon` skips
  `withBundleCache`.
- The dialog is an island that mounts `<Frame>` for the clicked tile, so the address stays on
  the gallery while it is open; a named-frame link would move the address to the icon's page.
  A click with a modifier, or a middle click, still opens the icon's page.
- The grid always renders every tile and `?q=` marks the rest `hidden`, so the live filter can
  widen a query the server narrowed. The page weighs the same for every query.
- The filter and the customizer are one `GET` form, so both work without script. The colour
  is `@sdxc/ui/color`'s `ColorPicker`: a hex text field, empty for the text colour around the
  icons, with its picking surface opening from the swatch beside it.
- The dialog closes on a backdrop press through `dialogDismiss()`, since `closedby` is
  missing from some engines.
