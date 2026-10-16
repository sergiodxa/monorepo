# ADR-156: Shared Search Dialog

## Status

**Proposed** - 2026-10-16

## Background

sergiodxa.com (`apps/blog`) and sdxc.dev (`apps/sdxc-site`) open the same search dialog with ⌘K.
It is a server-frame design: a static trigger that links to `/search`, a `<dialog>` that holds a
`<Frame>` pointed at the app's search frame endpoint, and a search box island that reloads that
frame as the reader types, with kind tabs, counts, and `kind:` filters (ADR-117).

sdxc.dev was rebuilt from the blog's version, and the two were then brought into line: the tab
strip keeps a minimum height, the dialog closes once a soft navigation settles, and the box takes
its label as a prop. Most of the client code is now the same file in two places, so every fix has to
be made twice, and the second copy can easily be missed.

## Context

### What differs today

| File in `resources/components/` | Lines | Difference between the two apps                                                                                                                                                     |
| ------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search-box.tsx`                |   455 | Import specifiers only                                                                                                                                                              |
| `search-surface.ts`             |   100 | Import specifiers only                                                                                                                                                              |
| `quiet-search-input.tsx`        |    97 | Import specifiers only                                                                                                                                                              |
| `search-tabs.tsx`               |    84 | Import specifiers, and the tab type's name (`SearchViewModel.Tab` / `SearchResults.Tab`); both types have the same shape                                                            |
| `search-keys.ts`                |   136 | The blog opens the dialog from the trigger on wide screens only, and rewrites the ⌘K hint to "Ctrl K" in the browser; sdxc.dev renders the hint on the server with `keyComboGlyphs` |
| `search-trigger.tsx`            |    46 | Different look (a nav pill or a `LinkButton`); same dialog id and trigger attribute                                                                                                 |
| `search-result.tsx`             |   111 | Different by design: activity rows with emoji, or kind icons with summaries                                                                                                         |
| `search-quick-links.tsx`        |   130 | Different by design: each site's own sections                                                                                                                                       |
| `results-pager.tsx`             |    67 | Small, per-page markup                                                                                                                                                              |

### Coupling inside the shared files

- `search-box.tsx` exports six ids and id builders (`SEARCH_RESULTS_ID`, `SEARCH_LISTBOX_ID`,
  `searchOptionId`, `SEARCH_QUICK_LINKS_ID`, `searchQuickLinkId`, plus the input id passed as a
  prop). The app's frame view and its quick links import the same constants, because the island
  finds the elements by id.
- `search-keys.ts` reads `SEARCH_DIALOG_ID` and `SEARCH_TRIGGER_ATTRIBUTE` from the app's trigger
  module.
- Island props must serialize, so any per-app behavior has to be passed as data, not as a
  callback.

## Decision

Add the shared client pieces to `@sdxc/search` under a new `@sdxc/search/ui` entry point. Leave
the server side in each app, and create no new package.

### Exports of `@sdxc/search/ui`

#### Ids

```ts
interface SearchIds {
	input: string;
	results: string;
	listbox: string;
	quickLinks: string;
	option(index: number): string;
	quickLink(index: number): string;
}

function searchIds(prefix: string): SearchIds;
```

`searchIds("site-search")` gives `site-search-q`, `site-search-results`, `site-search-options`,
and so on. This one function replaces the six constants, so the island and the app's frame view
can't disagree about an id.

#### `SearchBox` island

```tsx
<SearchBox
	ids="site-search"
	label="Search guides and packages"
	query={model.query}
	frameSrc={routes.searchFrame.href()}
	dialogId="site-search"
	optionCount={model.items.length}
	kind={model.kind ?? ""}
	kinds={tabs.map((tab) => tab.kind ?? "")}
	triggerAttribute="data-search-trigger"
	triggerMedia="(min-width: 40rem)"
/>
```

| Prop               | Purpose                                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `ids`              | Prefix passed to `searchIds`                                                                                                            |
| `label`            | The input's accessible name and placeholder                                                                                             |
| `query`            | The text the frame was rendered for                                                                                                     |
| `frameSrc`         | The frame endpoint without a query, so each app's route owns its address                                                                |
| `dialogId`         | The `<dialog>` the keys, trigger and backdrop control                                                                                   |
| `optionCount`      | Rows in the listbox, for arrow-key movement                                                                                             |
| `kind`, `kinds`    | The current tab and the tabs present, for kind switching                                                                                |
| `triggerAttribute` | The attribute on the trigger link. Default `data-search-trigger`                                                                        |
| `triggerMedia`     | Optional media query a plain click on the trigger must match before it opens the dialog. Without it, every plain click opens the dialog |

`data-search-card`, `data-search-follow` and `data-search-kind` become fixed constants that the
package exports, since nothing needs to rename them.

#### Page-wide behavior

`watchSearchDialog(signal, { dialogId, triggerAttribute, triggerMedia })`, `searchShortcut` and
`opensDialog`. The island calls `watchSearchDialog` itself; the functions are exported so apps can
test against them.

#### Presentation

- `SearchTabs`, taking `SearchTab { kind: string | null; label: string; count: number; href: string; current: boolean }`
- `QuietSearchInput`, `QuietSearchRow`
- `searchSurface()`, `searchSurfaceMotion(enterDelay)`, `SEARCH_EXIT_MS`

#### `searchFrameSrc(frameSrc, text, kind)`

Builds the frame URL for the layout's first `<Frame src>` and for the island's reloads.

### What stays in each app

- The route, the frame endpoint, and the `/search` page
- Query parsing into each site's kinds, and the results and tabs model
- The frame view: the box, the card, the status line, and "See all"
- The trigger, result row, quick links, and pager
- The `<dialog>` and `<Frame>` markup in the layout or header

### Change in the blog first

Render the trigger's shortcut hint on the server with `keyComboGlyphs`, as sdxc.dev does, and
remove `labelShortcut` and `SEARCH_SHORTCUT_ATTRIBUTE`. Then the package needs no option for
rewriting the hint.

## Consequences

### Positive

- **One copy** - about 870 duplicated lines become a single package module, so each fix ships to
  both sites at once.
- **Ids from one function** - the frame view and the island read their ids from `searchIds`.
- **Matches the `./ui` convention** - the components sit beside the query syntax their `kind:`
  tabs depend on.

### Negative

- **More dependencies for `@sdxc/search`** - it gains `@sdxc/ui`, `@sdxc/u` and `@sdxc/icons`,
  which server-only users such as the reader also install.
- **Released API** - changing the dialog becomes a dated package release that both apps pick up,
  where today one app can change on its own.
- **The look is shared** - the surface styles and tabs set the visual design for both sites. A site
  that wants a different card has to write its own instead of passing props.

### Neutral

- **Both apps keep their own server side** - a third app writes its own route and frame view, and
  uses the package for everything else.

## Implementation Plan

### Phase 1: Package entry point

**Priority:** Medium
**Estimated Effort:** Half a day

1. Move `search-box`, `search-keys`, `search-tabs`, `search-surface` and `quiet-search-input`
   from `apps/sdxc-site` into `packages/search/src/ui.tsx` (and sibling modules). Replace the id
   constants with `searchIds` and add the `triggerAttribute` and `triggerMedia` props.
2. Move the apps' search-box, search-keys and search-tabs tests into the package.
3. Add the `./ui` export, the new dependencies, and a one-line README mention.

### Phase 2: sdxc.dev on the package

1. Import from `@sdxc/search/ui`, and delete the five app copies.

### Phase 3: Blog on the package

1. Render the shortcut hint on the server.
2. Import from `@sdxc/search/ui` with `triggerMedia={WIDE_SCREEN}`, and delete the five app
   copies. `search-dialog.test.tsx` stays in the blog, since it runs the blog's router and
   renderer.

## Alternatives Considered

### 1. Add the components to `@sdxc/ui`

**Rejected because**: every `@sdxc/ui` component gets a catalogue page and a live preview on
sdxc.dev, and an entry in the `sdxc ui` registry. This widget only works against a server frame
endpoint, so a preview would need a fake endpoint, and copying it from the registry would bring no
server side with it. `Command` in `@sdxc/ui` is the client-side palette over a fixed list of
options.

### 2. A new `@sdxc/search-dialog` package

**Rejected because**: it would be another package whose only consumers already depend on
`@sdxc/search`, and it would also need a separate npm bootstrap and trusted publisher.

### 3. Keep one copy per app

**Rejected because**: the three fixes listed in the Background each had to be made by hand in the
second app.

## References

- [ADR-109: Search Package](./ADR-109-search-package.md)
- [ADR-117: Search Query Syntax](./ADR-117-search-query-syntax.md)
