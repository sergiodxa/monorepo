# ADR-195: Emoji Package

## Status

**Accepted** - 2026-11-13

## Background

`@sdxc/markdown` deliberately left emoji shortcodes out of the parser baseline
([ADR-058](./ADR-058-first-party-markdown-parsing.md)): replacing `:tada:` means shipping a table of
roughly eighteen hundred names, which is the weight that ADR removed. A visitor over `text` nodes
from another package was the intended home
([ADR-124](./ADR-124-markdown-comments-and-attribute-expressions.md) says weighty plugins ship as
their own package with a `/markdown` subpath, the way `@sdxc/highlight` and `@sdxc/math` do).

Several surfaces now want that capability at once: blog markdown rendering and CMS fields; Chorus
composers and messages; Tern's chat composer; Cairn issue titles, descriptions and comments. They
also want a browse picker (search + grid + categories) and a `:name` autocomplete, including
workspace custom emoji that render as images.

## Context

### Consumers

| App / surface                         | Needs                                              |
| ------------------------------------- | -------------------------------------------------- |
| Blog post / page markdown walk        | Shortcode → character in `text` nodes              |
| Blog CMS fields                       | Field mixin + suggest / picker                     |
| Chorus composers and DMs              | Mixin, suggest, picker, string replace on display  |
| Tern `Composer.Input`                 | Same                                               |
| Cairn issue title (`input`), body, comments | Same; titles are where `:bug:` is typed      |
| ActivityPub custom emoji (later)      | Shortcode → image URL, same custom entry shape     |

### What the catalog has to solve

There is no standard for colon shortcodes. GitHub (gemoji), Emojibase presets, and iamcal
emoji-datasource each map overlapping but different names to the same glyph (for example the
thumbs-up character answers to `+1`, `thumbsup`, and similar aliases). A picker grid must show
each glyph once; replace and autocomplete must accept every known alias.

Custom emoji are not Unicode: they are a shortcode whose display is an image. Products keep
`:name:` in stored text and swap to `<img>` at render time. A plain `<textarea>` or `<input>`
cannot embed image chips, so the field mixin inserts the shortcode and render/tokenize does the
image swap.

### Worker weight

A merged shortcode catalog is tens to hundreds of kilobytes. Dynamic `import()` defers parse and
keeps unused paths off the cold start, but Wrangler still packs the chunk into the Worker upload.
Runtime fetch (KV / R2 / URL) is how a deploy truly omits the bytes. The package API must accept a
caller-supplied map that may be loaded asynchronously; the built-in catalog must live on a
separate entry so the root module never pulls it in.

## Decision

Create `@sdxc/emoji` as a first-party package with a generated multi-source catalog, string and
token APIs, a markdown walk visitor, and composable UI — no `createEmoji` binder.

### Package entries

| Entry                   | Role                                                                 |
| ----------------------- | -------------------------------------------------------------------- |
| `@sdxc/emoji`           | Types, `merge`, `replaceShortcodes`, `tokenize`, render helpers      |
| `@sdxc/emoji/catalog`   | Generated `EmojiEntry[]`, derived shortcode index, category list     |
| `@sdxc/emoji/markdown`  | `Markdown.walk` visitor over `text` (skips code / like typography)   |
| `@sdxc/emoji/ui`        | `EmojiPicker`, `EmojiSuggest`, field mixin, `ui:emoji-pick` event    |

Root never imports the catalog. Apps that want the built-in table load
`@sdxc/emoji/catalog` (or fetch equivalent JSON) and pass it in.

### Catalog shape (inverted)

The canonical table is one entry per emoji (or per custom image), not one row per shortcode:

```ts
type EmojiCategory =
	| "smileys-emotion"
	| "people-body"
	| "animals-nature"
	| "food-drink"
	| "travel-places"
	| "activities"
	| "objects"
	| "symbols"
	| "flags"
	| "custom";

interface UnicodeEmoji {
	emoji: string;
	shortcodes: string[];
	category: Exclude<EmojiCategory, "custom">;
	tags?: string[];
	/** ASCII emoticons that resolve to this emoji, e.g. `:)` */
	emoticons?: string[];
}

interface CustomEmoji {
	shortcodes: string[];
	src: string;
	category: "custom";
	label?: string;
}

type EmojiEntry = UnicodeEmoji | CustomEmoji;
```

The grid iterates entries once. A derived `Record<string, EmojiEntry>` (shortcode → entry) powers
replace, suggest, and tokenize. Building that index is the package's job at merge/load time.

### Multi-source generation

A package script downloads pinned OSS sources, merges them, and commits the result:

| Priority | Source                                      | Contributes                         |
| -------- | ------------------------------------------- | ----------------------------------- |
| 1        | Unicode / Emojibase compact                 | Glyph set, category, sort order     |
| 2        | gemoji                                      | GitHub aliases and tags             |
| 3        | Emojibase shortcode presets                 | Extra aliases (`github`, `iamcal`, …) |
| 4        | iamcal emoji-datasource                     | Remaining `short_names`, emoticons  |

Rules:

- Document URLs, pins, and licenses in `SOURCES.md`.
- Normalize each glyph to one catalog key (stable variation-selector / ZWJ form) so the same
  character from two sources merges.
- Union shortcodes and emoticons onto that entry; preferred shortcode order follows source
  priority (first seen wins as primary).
- If the same shortcode would point at two different emoji, keep it on the winner by source
  priority (gemoji over iamcal when they disagree), strip it from the loser, and append the case
  to `scripts/conflicts.md`. Never invent or rename shortcodes.
- Allow a small `scripts/overrides.json` applied last for hand fixes.
- Emit `EmojiEntry[]` plus the derived shortcode index. CI fails when committed data drifts from
  the script.
- No localization in-tree. An app that needs localized search names supplies its own table or
  extends the built-in one through `merge`.

Skin-tone modifier rows are omitted from the catalog and from the picker. Only the default
(unmodified / “yellow”) forms ship; tone pickers are out of scope.

### `merge`, replace, tokenize, render

```ts
merge(base: EmojiEntry[], extra: EmojiEntry[]): EmojiEntry[]
```

`merge` concatenates and re-indexes. When a shortcode collides, **custom wins over Unicode**, then
later extras win over earlier ones within the same kind. That is how a tenant `:smile:` image
overrides the Unicode smiley.

```ts
replaceShortcodes(text: string, index: ShortcodeIndex): string
```

Replaces only complete `:name:` tokens that resolve to a **Unicode** entry (and ASCII emoticons
where supported). Unknown names and custom shortcodes stay as written. Code spans and fences are
not this function's job — callers that hold markdown use the walk visitor.

```ts
tokenize(text: string, index: ShortcodeIndex): EmojiSegment[]
```

```ts
type EmojiSegment =
	| { type: "text"; value: string }
	| { type: "unicode"; emoji: string; name: string }
	| { type: "custom"; name: string; src: string; label?: string };
```

Render helpers turn segments into plain text, HTML, or remix nodes: Unicode as characters, custom
as `https:` images only (reject other URL schemes). Broken `src` falls back to showing `:name:`.

### Markdown plugin

`@sdxc/emoji/markdown` exports a visitor factory that takes the shortcode index (or entries),
walks `text` nodes the way typography does, leaves `inlineCode` / code blocks alone, and uses
tokenize so custom shortcodes become inline image markup or tags the renderer already understands.
Literal `:name:` in source that must survive is left as Escape-cancelled typing in composers, or
as content inside code.

### UI: two compounds, one event

Host-agnostic panels; the app places them in `<dialog>`, a popover, or inline.

1. **`EmojiPicker`** — browse: search, virtualized grid, category tabs (composed above or below),
   optional custom category. Recents are a **prop** (`recents: string[]` of shortcodes or emoji
   keys); how the app persists them (cookie, `localStorage`, DB) is outside the package.
2. **`EmojiSuggest`** — colon autocomplete list (glyph or `<img>`, `:name:`, match highlighting).

Both accept `mix`, forward it to the host, and ship no user-facing copy: every label and
placeholder is a required prop. Behavior is mixins; picking dispatches a bubbling, cancelable
`ui:emoji-pick` (`EmojiPickEvent`) — not an `onPick` callback — carrying a discriminated payload:

```ts
// Unicode
{ kind: "unicode"; emoji: string; name: string }
// Custom
{ kind: "custom"; name: string; src: string; label?: string }
```

### Field mixin

`emojiInput({ map / index, … })` applies to text-like `<input>` and `<textarea>` (not
`password`, `email`, `url`, `number`, and similar). Typing `:` opens Suggest (not the grid at the
same time). Enter inserts the active match; a second `:` that closes a valid token inserts the
first match; Escape closes and leaves `:partial` as typed. Inside fenced code in a textarea, `:`
does not open the picker. A toolbar control may open `EmojiPicker` in a dialog; only one of
Suggest or Picker is open.

On pick: Unicode inserts the character; custom inserts `:name:`. Images are never inlined into
the field. Display paths run tokenize/render (or the markdown visitor) so customs become images.

Custom image bytes live wherever the app stores them (DB, R2, CDN). The catalog only holds
`https:` `src` strings.

### Accessibility and composition

Search keeps focus; arrows move `aria-activedescendant` through the grid or list; Enter picks;
Escape closes; focus returns to the field or trigger. Category controls are a tablist. The grid
is virtualized. Unsupported / undrawable glyphs may be hidden when the runtime can probe them.
Styling follows `@sdxc/ui` (`mix`, semantic tokens, compound parts). Mobile keeps the picker for
custom emoji even when the OS emoji keyboard covers Unicode.

### First integrations (after the package)

| Consumer | Integration                                      |
| -------- | ------------------------------------------------ |
| Blog     | Catalog + markdown visitor in existing walks; CMS mixin |
| Chorus   | Mixin on composers; replace/tokenize on display  |
| Tern     | Mixin on `Composer.Input`                        |
| Cairn    | Mixin on title input and description/comment fields |

## Consequences

### Positive

- One catalog serves replace, suggest, picker, and markdown without duplicating alias tables.
- Custom emoji share the same APIs without forcing images into plain text fields.
- Apps control bundle weight: import the catalog, fetch JSON, or pass a tiny custom-only map.
- UI matches the rest of the catalog: `mix`, required labels, `ui:*` events, no callback props.
- Provenance and conflicts stay auditable through the generator.

### Negative

- Maintaining the generator and conflict log is ongoing work when Unicode or upstream lists move.
- Plain text fields show `:custom:` until a render pass runs; there is no inline chip without a
  richer editor.
- Omitting skin-tone variants disagrees with native OS pickers that expose them.
- Aggregating several shortcode lists means some aliases will surprise authors used to only
  GitHub or only Slack.

### Neutral

- Recents persistence is an app concern; the picker only receives the list.
- ActivityPub custom emoji tags fit the same `CustomEmoji` shape when federation needs them.
- ASCII emoticons are part of replace/tokenize; they are absent from the colon-suggest path unless
  the typed text matches an emoticon form.

## Implementation Plan

### Phase 1: ADR and package skeleton

**Priority:** High

1. Land this ADR.
2. Scaffold `@sdxc/emoji` with entries, `merge` / replace / tokenize types, empty catalog hooks,
   tests, README, and package registration (root README, sdxc groups, release bootstrap).

### Phase 2: Catalog generator

**Priority:** High

1. Implement download + merge script with pinned sources, normalization, conflict log, overrides.
2. Commit generated catalog and `SOURCES.md`; wire `bun run generate` and a drift check.

### Phase 3: Markdown and core APIs

**Priority:** High

1. Finish `replaceShortcodes`, `tokenize`, render helpers, and `./markdown` visitor.
2. Blog walk integration behind the injected catalog.

### Phase 4: UI

**Priority:** High

1. `EmojiSuggest`, `EmojiPicker` compounds, `EmojiPickEvent`, field mixin.
2. Wire Chorus, Tern, and Cairn composers; CMS fields on the blog as follow-ups.

## Alternatives Considered

### 1. Shortcode → emoji as the canonical map

**Rejected because**: the grid would have to dedupe by value on every render, and aliases would
duplicate cells unless a second structure existed anyway. Inverting once at generation time is
cheaper and matches “one glyph, many names.”

### 2. `createEmoji(map)` binding that closes over replace / markdown / UI

**Rejected because**: it does not match visitors and mixins elsewhere (`variables(values)`,
`createMathVisitor(options)`). Async loading either makes construction always async or hides
promises inside methods. Bare functions plus a required map (resolved at the app edge) stay
tree-shakeable.

### 3. Built-in catalog imported from the package root

**Rejected because**: every consumer would pay for the table, and “replace the map” would not
avoid loading it. A separate `@sdxc/emoji/catalog` entry (or fetched JSON) keeps the root light.

### 4. Skin-tone picker and per-tone catalog rows

**Rejected because**: the product choice is to ship only default forms; tone UI adds catalog,
a11y, and storage complexity without a current consumer request.

### 5. Putting emoji shortcodes inside `@sdxc/markdown/plugin/*`

**Rejected because**: ADR-058 and ADR-124 already reserve weighty data for a sibling package with
a `/markdown` subpath.

### 6. `onPick` callback props on the picker

**Rejected because**: `@sdxc/ui` uses namespaced DOM events and `mix` / `on("ui:…")`. Callbacks
fight that model and force hydration patterns the catalog avoids on pure components.

## References

- [ADR-058: First-party markdown parsing](./ADR-058-first-party-markdown-parsing.md) (emoji
  shortcodes deferred)
- [ADR-124: Markdown comments and attribute expressions](./ADR-124-markdown-comments-and-attribute-expressions.md)
  (heavy plugins as `/markdown` packages)
- [ADR-125: Math package](./ADR-125-math-package.md) (sibling pattern: core + `/markdown` + `/ui`)
- [gemoji](https://github.com/github/gemoji)
- [Emojibase](https://github.com/milesj/emojibase)
- [iamcal/emoji-data](https://github.com/iamcal/emoji-data)

## Current Progress

- [x] Decision recorded
- [ ] Package scaffold
- [ ] Catalog generator and committed data
- [ ] Core APIs (`merge`, replace, tokenize, render)
- [ ] Markdown visitor
- [ ] UI compounds, event, field mixin
- [ ] Blog / Chorus / Tern / Cairn wiring

## Notes

- Custom `src` must be `https:` only.
- Suggest and Picker never open together on the same field.
- Escape in the field mixin closes UI and preserves the typed `:partial` text.
- The generator's conflict log is part of the review surface when refreshing upstream data.
