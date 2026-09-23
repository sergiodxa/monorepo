# ADR-001: A website for the published `@sdxc` packages

## Status

**Proposed** - 2026-09-21

## Background

Sixty packages under `packages/*` are public, and all but three are published on npm under
the dated scheme from [ADR-007](../ADR-007-publishable-package-releases.md), spread across
`2026.9.11` through `2026.9.17`; the remaining three ship within hours. Their entire public face
today is an npm page per package and a table in the root `README.md`. Nothing explains what the collection is, why the packages look the way
they do, or which one to reach for; a reader who lands on `@sdxc/feed` has no way to discover
`@sdxc/rss`, `@sdxc/atom` and `@sdxc/json-feed` sitting underneath it.

## Context

### What exists

| Item                    | State                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public packages         | 60; every one carries a `description`, a `README.md` and a `LICENSE.md`, enforced by `test/public-packages.test.ts`                               |
| README corpus           | 1.6 MB across 62 files; `@sdxc/u` alone is 707 KB, `@sdxc/spec` 54 KB, `@sdxc/ui` 42 KB                                                           |
| Package README contract | [ADR-017](../ADR-017-readme-package-description-source-of-truth.md) makes the README the source of truth for the description                      |
| Versioning              | Dated, `YYYY.M.D`, at most one release a day; no changelog files, release notes are the day's commits on a GitHub Release                         |
| External dependencies   | 32 of 60 have none; the whole set draws on `remix`, `@standard-schema/spec`, `jose`, `linkedom`, `i18next` and two parsers                        |
| Framework coupling      | 38 of 60 depend on nothing from Remix; 22 target `remix` directly                                                                                 |
| Markdown rendering      | `@sdxc/markdown` parses to a typed AST, `toRemix` renders it, `@sdxc/highlight` paints code through a walk visitor                                |
| Prior art               | `apps/uptime` already serves a docs site from `resources/docs/**/*.md` through `import.meta.glob` — the pattern to copy                           |
| Doc extraction          | `@sdxc/jsdoc` reads JSDoc out of JS and TS source text into a JSON documentation model — in flight, and exactly what the two catalogue trees need |

### The rendering mechanism the landing page needs

`@sdxc/markdown` already has the two features a content-driven landing page is built from, so
nothing new has to be invented for it:

- **Tags** — `<hero>`, `<feature-grid>` — are registered names with an attribute schema, whose
  children are parsed as markdown all the way down. An unregistered name stays raw HTML, and a
  bad attribute is a parse error with a line number.
- **Annotations** — `{% key="value" %}`, plus `#id` and `.class` shorthands — attach attributes
  to a block that already exists, including a fenced code block's opening line.

`toRemix(document, { components })` keys components by tag name _or by node type_, so a
component can take over every `heading` or `code` node in the document without the author
marking them up.

### Constraints this plan works under

- The 1.6 MB README corpus is inlined into the Worker bundle by `import.meta.glob`. Raw text
  compresses hard, so this is well inside the bundle limit, but it is the single largest cost
  in the design and the reason `@sdxc/u`'s 707 KB README gets a look of its own.
- Markdown must be parsed per request, never at module scope: work in the Worker global scope
  fails upload validation, and a dry run does not catch it.

## Decision

Build `apps/sdxc` — a Remix v3 app on Cloudflare Workers — serving a marketing landing page and
one documentation tree that holds both handwritten guides and a reference for every public
package.

Deployed to `sdxc.sergiodxa.com`, moving to `sdxc.dev` later. The domain settles the naming
question: `@sdxc` is a project with a name of its own, not a byline, so the copy says _"sixty
packages"_ rather than _"Sergio's packages"_, and the authorship line does the attributing.

Everything documentary lives under `/docs`. There is one sidebar, one search index, one shell:

| Route                          | Content                                       | Source                            |
| ------------------------------ | --------------------------------------------- | --------------------------------- |
| `/`                            | The landing page                              | `resources/content/home.md`       |
| `/docs`                        | The hub — routes a reader by intent           | View                              |
| `/docs/<slug>`                 | Handwritten guides                            | `resources/docs/**/*.md`          |
| `/docs/packages`               | The package index, filterable                 | Manifests                         |
| `/docs/packages/:name`         | One package's reference                       | `packages/<name>/README.md`       |
| `/docs/packages/u/:utility`    | One utility, Tailwind-style                   | Generated from source + JSDoc     |
| `/docs/packages/ui/:component` | One component, shadcn-style                   | Generated from source + JSDoc     |
| `/philosophy`, `/showcase`     | The essay, and the apps built on the packages | Markdown / manifests              |
| `/mcp`                         | The MCP endpoint agents connect to            | `@sdxc/mcp` over the same content |

`packages` is a reserved first segment under `/docs`, so no guide slug may take it.

**Every count on the site is read from the manifests at request time, never written into the
copy.** `@sdxc/jsdoc` flipped from public to private during this plan's own drafting and moved
the total from 61 to 60 — a number typed into a sentence is wrong the day a package opens or
closes. The markdown carries `{% $packageCount %}` holes that resolve per render, and a test
asserts the resolved value against the manifests.

The landing page being a markdown file is the load-bearing choice: editing the pitch is editing
one file, no view code, no redeploy of a component tree.

---

## Part 1 — The landing page

### What it must not do

The reference sites lean on scale: logo walls, contributor grids, download counters, sponsor
tiers, Discord member counts, conference schedules. None of that is true here, and a page that
gestures at it reads as a lie. The honest version of this page substitutes **the work itself**
for social proof — code you can read, decisions you can check, a number of packages that speaks
for itself.

### Section inventory

#### 1. Hero

**Job**: say what this is in one line, before the reader decides whether to scroll.

- Wordmark, one-sentence thesis, one supporting sentence.
- Two actions: **Read the docs** (primary) and **Browse the packages** (secondary).
- A copyable `npm add @sdxc/result` line.

**Copy direction**: the thesis is the collection's actual through-line — _"Small TypeScript
packages built on web standards. Take one, or take the set."_ The supporting line names the
substance, and names the framework: these are written for Remix on Cloudflare Workers, and most
of them run without either. Selling framework neutrality would undersell the integration the
audience is actually here for, and 22 of the 60 target Remix directly.

**Snippet**: none. The hero stays text; the first code the reader meets is section 2, where it
has a point to make.

#### 2. The thesis, in code

**Job**: prove the claim in the hero within one screen.

One snippet, chosen because it shows the house style rather than a feature — a handler that
composes three packages and never throws:

```typescript
import { badRequest, ok } from "@sdxc/response";
import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";

export async function handler(request: Request) {
	let result = Markdown.parse(await request.text(), { frontmatter: Frontmatter });
	if (isFailure(result)) return badRequest({ line: result.error.position?.start.line });
	return ok(result.data.frontmatter);
}
```

Three annotated points beside it: _failure is a value_, _`Request` in, `Response` out_, _every
package agrees on both_.

#### 3. What holds the set together

**Job**: the four properties every package shares, so a reader can predict the next one.

A four-card grid, each card a claim with the number that backs it:

| Card                           | Claim                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| **Web standards first**        | `Request`, `Response`, Web Crypto, `Intl`, Standard Schema — the platform, not a shim         |
| **Errors are values**          | Every fallible entry point answers with a `Result`; nothing throws past you                   |
| **Nothing you didn't ask for** | 32 of 60 have no external dependency at all; subpath exports keep the rest out of your bundle |
| **Runs wherever fetch does**   | 38 of 60 need no framework; the rest target Remix on purpose                                  |

**Snippet**: none — the grid carries it.

#### 4. The packages, by the problem they solve

**Job**: turn sixty names into something browsable in ten seconds.

Grouped tiles, name + one-line description pulled from each `package.json`. Groups:

| Group               | Packages                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------- |
| HTTP & responses    | `http` `response` `api-client` `pagination` `server-timing` `catch-response-middleware`   |
| Identity & security | `auth` `jwt` `passkey` `saml` `crypto` `webhooks` `uuid` `typeid`                         |
| Content & formats   | `markdown` `yaml` `xml` `html` `rss` `atom` `json-feed` `feed` `opml` `sitemap` `distill` |
| Data & storage      | `cache` `workers-cache` `session-storage-kv` `data-table-d1` `data-table-sqlstorage`      |
| Interface           | `ui` `u` `icons` `i18n` `seo` `highlight`                                                 |
| Operations          | `jobs` `cron` `logger` `rate-limit` `flags` `flags-engine` `billing` `mail` `hostname`    |
| Language & values   | `result` `types` `dates` `duration` `strings` `semver` `location` `validate`              |
| Testing             | `spec` `sample` `cloudflare-mocks`                                                        |

Footer link: **Every package →** `/packages`.

#### 5. Three packages worth the detour

**Job**: depth, after the breadth of section 4. Three tabbed snippets, one per package, each
one a thing the reader cannot get elsewhere.

- **`@sdxc/spec`** — executable specifications in a language with no `if` and no loops, run in
  a fresh workspace under explicit permission grants.
- **`@sdxc/u` + `@sdxc/ui`** — accessible components on `<dialog>`, the Popover API and
  Invoker Commands, rendered as server HTML that works before any JavaScript loads.
- **`@sdxc/markdown`** — GFM to a typed AST you can walk, transform and write back; this very
  page is one.

That last line is the section's whole argument, so it is stated on the page.

#### 6. Install and pin

**Job**: explain dated versioning before the reader meets `2026.9.21` on npm and assumes it is
broken.

Short prose + one `package.json` snippet with an exact pin, and the one rule: a later date is a
later release and promises nothing about compatibility, so pin exactly and move when ready.

#### 7. Closing

**Job**: route the three kinds of reader who make it this far.

Rails' "Let's get started" pattern rather than a pair of bare links — three labeled cards, one
per intent:

| Card         | Goes to                                  |
| ------------ | ---------------------------------------- |
| **Learning** | `/docs` — start with the guides          |
| **Browsing** | `/docs/packages` — every one, filterable |
| **Watching** | `/releases` — what shipped, and when     |

Then the MIT line and authorship. No newsletter, no Discord, no sponsor tier.

A link to the philosophy page belongs here or in section 3; all three reference sites surface
theirs from the landing page rather than only from docs.

### How the page is authored

`resources/content/home.md`, rendered by `toRemix` with a component per tag. The tags below
are the app's whole vocabulary, and the attribute schema of each one is what makes a typo a
parse error with a line number instead of a blank section:

````text
<hero cta-href="/docs" cta-label="Read the docs">
# Small TypeScript packages built on web standards.

Take one, or take the set. `Request` and `Response` in, typed values out, and no
framework underneath unless you ask for one.

<copyable>npm add @sdxc/result</copyable>
</hero>

<section-block id="thesis" title="Failure is a value, not a control flow">

```typescript {% .lead %}
import { badRequest, ok } from "@sdxc/response";
```

<note>Every fallible entry point answers with a `Result`.</note>
</section-block>

<feature-grid>
<feature title="Web standards first">
`Request`, `Response`, Web Crypto, `Intl`, Standard Schema — the platform, not a shim.
</feature>
<feature title="Errors are values">
Every fallible entry point answers with a **`Result`**; nothing throws past you.
</feature>
</feature-grid>

<package-groups source="registry" />
````

| Tag              | `content` | Attributes                           | Renders                                 |
| ---------------- | --------- | ------------------------------------ | --------------------------------------- |
| `hero`           | blocks    | `cta-href`, `cta-label`, `alt-href`… | The full-bleed opening panel            |
| `copyable`       | inline    | —                                    | A code line with a copy button          |
| `section-block`  | blocks    | `id`, `title`, `tone`                | A titled landing section                |
| `feature-grid`   | blocks    | `columns`                            | The grid container                      |
| `feature`        | blocks    | `title`, `icon`, `metric`            | One card                                |
| `code-tabs`      | blocks    | —                                    | Tab strip over the fenced blocks inside |
| `package-groups` | none      | `source`                             | Section 4, generated from the workspace |
| `note`           | blocks    | `kind`                               | An inline aside                         |

`package-groups` is the one tag that reads data rather than its own children — the grouping
table above lives in a small `content/groups.ts`, and the names and descriptions come from the
manifests, so a new package appears on the landing page the day it is published and a stale
description is impossible.

Code blocks are highlighted by the `@sdxc/highlight` walk visitor, merged with a heading-anchor
visitor into one pass. `toRemix`'s node-type components take over `heading`, `code` and `link`
so ordinary markdown in a doc page gets the same treatment with no tags written.

---

## Part 2 — The docs

### `/docs/<slug>` — handwritten guides

Straight adoption of the `apps/uptime` pattern: `resources/docs/**/*.md`, loaded lazily through
`import.meta.glob(..., { query: "?raw" })`, frontmatter validated by `remix/data-schema`, and
grouped into ordered sections for the index and the sidebar.

Frontmatter carries `title`, `description`, `section: { title, order }`, `order` and an optional
`lastUpdated` — the same schema `apps/uptime/app/services/docs.ts` already enforces.

Proposed outline:

| Section             | Pages                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| Getting started     | What these are · Install and pin · Your first handler                       |
| Conventions         | `Result` everywhere · Standard Schema validation · Subpath exports · Naming |
| Using them together | On Cloudflare Workers · With Remix v3 · Without a framework                 |
| Releases            | Dated versions · Upgrading · Deprecation and removal                        |
| Contributing        | Reporting a problem · Building from source                                  |

### `/docs/packages` — the index

Every public package, in the groups from landing section 4, each row carrying its name and
description. Filter-as-you-type over both, using `Command` from `@sdxc/ui`.

**No per-package dependency badge.** Only some packages would carry one, so the rows read
unevenly and the eye reads the badge as the row's subject instead of the description. The claim
is worth making once, as the aggregate on the landing page, and not sixty times.

### `/docs/packages/:name` — the reference

The package's own `README.md`, parsed and rendered with the same pipeline as a guide page,
framed by a header the app builds from the manifest: install line, internal dependencies as links
to their own pages, which of the showcase apps use it, and a link to the source on GitHub.

**Every fact in that header varies between packages.** A row identical across the catalogue is
chrome pretending to be information, and the header collected two of them before this was
noticed: the versioning scheme, which is one sentence repeated sixty times, and the licence,
which is `MIT` on all sixty manifests without exception. Both now have one page each and no row.

**The subpath exports are not in the header.** Rendered as a list they are long and repetitive —
every entry restarts with `@sdxc/<name>/` — and they pushed the README itself below the fold. A
reader who wants them has the README's own API section, which every package already carries.

**The boilerplate tail is stripped.** 58 of the 63 READMEs end with the same three sections —
`Versioning`, `License`, `Author` — carrying identical text. On npm each one earns its place; on a
site that renders all sixty, they bury the end of every page and repeat one paragraph 58 times.
The renderer drops a trailing run of those three headings, the licence becomes one word among the
header facts, and the versioning rule gets a page of its own that the header links to. The README
files are left alone, because they are published where those sections belong.

Two details the README corpus forces:

- **A table of contents.** Several READMEs are long and one is 707 KB. Headings are collected by
  a `Markdown.walk` traversal that returns nothing — the pattern is in `@sdxc/markdown`'s own
  README — and rendered as a sticky in-page nav.
- **`@sdxc/u` and `@sdxc/ui` do not use this route at all.** Their README is an index to a
  catalogue — 293 utilities and 100 components — which is a documentation site, not a page. Both
  get purpose-built trees, below. Every other package renders whole.

A package README's relative links (`./LICENSE.md`, `../result`) are rewritten to site URLs by a
`Markdown.walk` link handler, so the same file reads correctly on npm, on GitHub and here.

### `/docs/packages/u/*` — the utility reference, after Tailwind

`@sdxc/u` is **293 utilities across 13 families**, every one a subpath export
(`@sdxc/u/size`, `@sdxc/u/color`, …). Names are unique across all families — verified — so URLs
stay flat like Tailwind's while the sidebar groups by family.

**Sidebar**: Tailwind groups by CSS property family and, importantly, names each leaf after **the
CSS property, not the class** — the page is `padding`, not `p-4`. Do the same: the URL is the
function name (`/docs/packages/u/p`), the H1 is the property (`padding`), and the function is
what the reference table shows. `@sdxc/u`'s own families already map closely onto Tailwind's
groups: `layout` (66), `size` (38), `effects` (35), `state` (27), `color` (24), `typography` (23),
`overflow` (20), `general` (16), `responsive` (16), `transform` (16), `animation` (6), `a11y` (3),
`stacking` (3).

**The page template**, following Tailwind's fixed skeleton so every page answers the same
questions in the same order:

| Block                     | Source                                                                    |
| ------------------------- | ------------------------------------------------------------------------- |
| Breadcrumb + H1           | Family + CSS property                                                     |
| One-line description      | The JSDoc summary                                                         |
| **Quick reference table** | The `@example` pairs — generated                                          |
| Examples                  | Hand-written, task-shaped H3s, rendered preview stacked above the snippet |
| Using a custom value      | The raw-CSS-length overload                                               |
| Applying on a state       | `u.hover(...)`, from the `state` family                                   |
| Responsive design         | `u.at("md", ...)`, from the `responsive` family                           |
| Customizing the theme     | The `--ui-*` variable the utility reads                                   |
| Prev/next pager           | Sidebar order                                                             |

The quick-reference table is the thing that makes this cheap, and it is **already written in the
source**. Tailwind's table is two columns, class and the CSS it emits, including the
arbitrary-value rows. `packages/u/src/size/p.ts` carries exactly that, as paired `@example` lines:

```typescript
/**
 * Applies logical padding using the spacing scale or a raw CSS length. One
 * value applies all sides; two values map to block then inline; four values
 * map to block-start, inline-end, block-end, and inline-start.
 *
 * @see [MDN: logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values)
 * @example u.p(4)
 * @example css({ padding: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 */
```

Call on the left, emitted CSS on the right, plus the MDN link Tailwind pages link by hand. A
build step emits one JSON record per utility: name, family, signature, description, `@example`
pairs, MDN link. **That step is `@sdxc/jsdoc`** — "read JSDoc out of JavaScript and TypeScript
source text into a JSON documentation model" — so the extraction is a package to consume rather
than tooling to write. The table cannot desync from the implementation, because it _is_ the
implementation's documentation.

#### Verified against the real corpus

`extract` was run over every file both trees read. It parsed **293 `@sdxc/u` modules and 100
`@sdxc/ui` components with zero failures**, and reported what each page needs: 297 of 298
exported utilities carry `@example` tags, 100 of 100 components expose a `Props` interface, and
51 expose compound parts. Two gaps surfaced and were fixed in the package; see below.

**Examples do not pair by position.** The quick-reference table assumes each `@example` call is
followed by the CSS it emits, and 282 of 298 utilities are written that way — 16 are not. Two
shapes account for all of them:

| Shape                                                                 | Utilities                                                                                             | Render as       |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------- |
| The output half is a quoted string, not a `css({…})` call             | `var` `env` `calc` `anchor` `anchorSize` `colorMix` `linearGradient` `radialGradient` `conicGradient` | A table row     |
| A composition utility taking other mixins, so there is no output half | `dark` `light` `if` `when` `keyframes`                                                                | A usage snippet |

So the rule is: **an example pairs with the next one when that next one is a `css(` call or a
quoted string; otherwise it stands alone.** That covers all 298. Pairing blindly by odd and even
index would have produced broken rows on sixteen pages, found one page at a time.

Only the Examples block is hand-written, in an optional `resources/docs/u/<name>.md` merged under
the generated reference. Most utilities never need one.

Two pages are not per-utility, following Tailwind's variant-reference pattern: **States** and
**Responsive design** each get one page with the full `Variant | CSS` table for their family.

### Two fixes `@sdxc/jsdoc` needed first

Both were found by running the extractor over `packages/ui/src/components/badge.tsx`, and both
are ordinary TypeScript that any documentation consumer hits — so they were fixed in the package
rather than worked around in the site. Tests went in first, in `packages/jsdoc/src/extract.test.ts`.

**A namespace merging with the function it names lost the function's comment.** Every one of the
100 components is `export namespace Badge { … }` beside `export function Badge(…)`. The merge
kept the namespace's `kind` and its comment, so the component's own description and its
`@example` blocks were dropped — the exact content a component page is built from. The merged
node now takes the value half's kind and comment, because the value is what a caller reaches for,
while the namespace contributes the types declared inside it.

**Static property assignments were not captured at all.** `Badge.Icon = function BadgeIcon(…)` is
how a component publishes its compound parts, and it is an expression statement rather than a
declaration, so nothing saw it. Those assignments now attach as children of the exported symbol
they extend, which is what makes the composition tree generable. An assignment whose owner is not
exported is still ignored.

After the fix, `Badge` extracts as a `function` with its own description, 3 `@example` blocks, a
`Variant` union of `"default" | "secondary" | "outline"`, three prop interfaces, and `Icon` and
`Text` as functions.

**One gap left, by design.** `@sdxc/jsdoc` never follows an import or runs a type checker, so a
default written as `@link DEFAULT_COLOR` pointing at a module-local constant stays prose — the
value `"neutral"` is not resolvable from the text alone. The props table therefore renders the
description as written rather than claiming a separate machine-readable default column. Changing
that would mean reporting non-exported declarations, which is a broader contract change than this
site justifies.

### `/docs/packages/ui/*` — the component reference, after shadcn/ui

`@sdxc/ui` is **100 components**, each a namespace of JSDoc'd prop interfaces:

```typescript
export namespace Badge {
	/** Visual weight the badge renders with: a solid fill, a tinted fill, or
	 *  a transparent chip with just an outline. */
	export type Variant = "default" | "secondary" | "outline";

	export interface Props extends TagProps<"span"> {
		/** Semantic color role. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
		/** Visual weight. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
	}
}
```

**The page template**, shadcn's order, with the two places to deviate marked:

| Block                    | Notes                                                                        |
| ------------------------ | ---------------------------------------------------------------------------- |
| H1 + one-line definition | shadcn opens with the ARIA definition of the pattern; the JSDoc already does |
| **Copy page**            | The `.md` twin, same affordance as the rest of the site                      |
| Hero live preview        | Preview with a **View code** toggle                                          |
| Installation             | **Deviates** — see below                                                     |
| Usage                    | Import block + minimal JSX, no prose                                         |
| **Composition tree**     | The compound parts, as a tree                                                |
| Examples                 | H3s named for a capability, each preview + code                              |
| **Props table**          | **Deviates** — see below                                                     |
| Prev/next pager          | Alphabetical neighbours                                                      |

**Three things `@sdxc/ui` gets to do better than the site it is imitating:**

1. **The live preview is nearly free.** These components render as server HTML and work before
   any JavaScript loads, so a preview is the docs page importing the component and rendering it.
   No sandboxed iframe, no bundler in the browser, no separate example app — what is on screen is
   the real component under the real stylesheet. This is the whole reason to imitate shadcn here.
2. **There is a real props table.** shadcn _delegates_ its API Reference to whichever primitive
   backs the component — Base UI, Radix, React Aria — because it does not own those props.
   `@sdxc/ui` has no upstream to defer to, and its namespaces carry the types, the prose and the
   defaults, so the table is generated and complete.
3. **RTL is a first-class example, and it passes.** shadcn ends every component page with an RTL
   example. `@sdxc/u` is logical-properties-first by default, so that section demonstrates
   something real rather than documenting a workaround.

**Installation deviates** because shadcn's install copies source into your project, which is why
its pages lead with a CLI and a package-manager tab strip. `@sdxc/ui` is an ordinary dependency:
the block is `npm add @sdxc/ui` plus the `theme.css` import, and the page spends the space it
saves on composition.

**The composition tree** is generated from the namespace: `Badge` with `Badge.Icon` and
`Badge.Text` is a tree with no prose to write.

**`/docs/packages/ui` index** stays a plain list of links. shadcn's component index is
deliberately unadorned — no cards, no thumbnails — and the gallery energy goes to `/blocks`
instead. With 100 components, a thumbnail grid is slower to scan, not faster.

**`/docs/packages/ui/theming`** follows shadcn's token page: a table of `token | what it controls
| which components use it`, then light and dark as two blocks over the same `--ui-*` names. The
third column is generated by grepping which components reference each variable. `@sdxc/ui`'s
`SemanticColor` roles are the analogue of shadcn's `X` / `X-foreground` pairs, and the page should
name that convention as explicitly as shadcn names theirs.

### `/mcp` — the docs as an MCP server

shadcn ships an MCP server for its registry and documents it as a product surface. `@sdxc/mcp` —
"Model Context Protocol servers as `remix/router` actions, served over stateless Streamable
HTTP" — is a package in this collection, so the site both provides the endpoint and is the
package's reference deployment.

Because revision `2026-07-28` made MCP stateless, this is **one route on the same Worker**: no
handshake, no session store, no second deployment. Every tool is `readOnlyHint: true` and reads
content already in the bundle, so the endpoint needs no authentication and can be published open.

**What the endpoint is actually for.** Every page already has a `.md` twin, so an agent that can
fetch a URL can already read all of this. Retrieval is solved. What an agent cannot do is _find
the thing_ — ask "is there a package for parsing OPML", or enumerate sixty packages it has never
heard of. So the tools are weighted toward **search and enumeration**, and a `get_page` tool that
only refetches a URL would be dead weight.

`@sdxc/mcp` splits the surface by who reaches for it: **a tool is chosen by the model, a resource
is picked by the person or attached by their client**, and `resources/list` is what puts a corpus
in the client's picker. That maps cleanly here.

**Tools** — what a model reaches for mid-task:

| Tool                     | Why it earns its place                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `search_packages(query)` | The highest-value call: "is there a package for X?" over name, description and README text |
| `search_docs(query)`     | The same build-time index `/search` uses, so one index serves both surfaces                |
| `get_package(name)`      | README plus the manifest facts — current version, subpath exports, dependencies            |
| `list_packages(group?)`  | The taxonomy from landing section 4, for an agent orienting itself                         |
| `get_utility(name)`      | One `@sdxc/u` utility from the generated model                                             |
| `get_component(name)`    | One `@sdxc/ui` component: props, defaults, composition tree                                |

The last two are the ones worth building the server for. `@sdxc/jsdoc` already produces a **JSON
documentation model** for those two catalogues, so an agent gets a typed record — signature,
parameters, defaults, `@example` pairs — instead of prose it has to parse back into facts. That
is strictly better than the markdown twin, and it exists as a byproduct of Phase 3b.

**Resources** — what a person attaches before they start:

| Resource                                    | `list`?        | Effect                                                 |
| ------------------------------------------- | -------------- | ------------------------------------------------------ |
| `https://sdxc.dev/docs/packages/:name.md`   | Yes, every one | Every package shows up in the client's resource picker |
| `https://sdxc.dev/docs/:slug.md`            | Yes            | The guides, likewise                                   |
| `.../u/:utility.md`, `.../ui/:component.md` | **No**         | Template only — see below                              |

The utility and component resources deliberately omit `list`. Per `@sdxc/mcp`'s own table, a
resource that captures variables and has no `list` appears in `resources/templates/list` and not
in `resources/list` — so a client receives the URI template and can expand it, while the picker
is spared 393 entries it would be useless to scroll. Getting that distinction right is the
difference between a usable picker and an unusable one.

URIs are `https://` rather than a private scheme because a client _can_ fetch these pages
directly, and `resource.href({ name })` builds them typed rather than concatenated.

A `/docs/mcp` page documents the connection, the way shadcn documents theirs.

### Caching

A rendered page depends only on files in the deployed bundle, so it is immutable for the life of
a deployment. Responses carry a long-lived `Cache-Control` and an `ETag` built from the release
version, through `@sdxc/http`; `@sdxc/workers-cache` tags them so a deploy purges the set.

---

## Part 2b — Reading surface

The first build was correct and plain. These are the affordances that make a documentation page
pleasant to read, drawn from [fumadocs.dev](https://fumadocs.dev), which the author picked as the
visual reference after seeing the first version.

### Table of contents

A small icon and "On this page" in sentence case, over a list whose items indent by heading
level against a thin vertical guide line. A coloured marker segment overlays that line, spanning
the heading or headings currently in view with a dot at its leading edge, and those items take
the accent colour while the rest stay muted. The line turns a rounded corner where the indent
level changes, so the marker traces the shape of the nesting.

It is sticky, and it scrolls on its own once it outgrows the viewport — a rail that is merely
long pushes the page taller and stops being a map.

Fumadocs marks state with `data-active` on the anchor and drives depth with `padding-left`, which
is the pattern to copy. Without JavaScript the list is plain anchor links with no active state.

### Code blocks

A fence carrying a `{% title="app/routes.ts" %}` annotation renders as a bordered card with a
header row: a file-type icon, the path in monospace, and a copy button at the far right. A fence
with no title renders without the header and keeps a floating copy button.

The path comes from the annotation `@sdxc/markdown` already supports on a fence's opening line,
so this is an attribute the `code` component reads rather than new syntax.

### Commands and their alternatives

An install or run command renders with a package-manager tab strip — `npm` `pnpm` `yarn` `bun` —
the active tab underlined in the accent colour, and a copy button that copies the visible
variant. The variants are **derived from one authored command**, because every package page shows
`npm add @sdxc/<name>` and asking an author to write four fences for it would be a tax on every
page. The reader's choice persists per browser.

This is narrower than the `code-tabs` tag, which stays for genuinely different samples.

### File structures

A `<files>` tag holding `<folder name="…">` and `<file name="…" />` renders a bordered card: a
folder or file icon per row, the name beside it, and a thin guide line down each level of
indentation showing what belongs to what. Folders nest.

It is a tag rather than a fenced code block because the structure is data — a reader gets icons
and alignment, and the document keeps something a renderer can style rather than pre-formatted
ASCII that wraps badly on a phone.

### Copy for a model, open elsewhere

Each page carries a **Copy Markdown** button beside an **Open** menu: view as markdown (the
page's own `.md` twin), open in GitHub, and open in the assistants a reader might paste it into.
This is the concrete form of the `.md` twins already committed to under Build, so it lands with
the route that serves them rather than before it.

### The changelog, and the cache that dates itself

A `Changelog` page joins `Versioning` under the **Releases** section, built from the repository's
GitHub Releases: one entry per `v YYYY.M.D` tag, its notes rendered through the same markdown
pipeline as everything else, newest first.

**The cache expires at midnight UTC, because that is when the content can change.** The release
workflow runs at 00:00 UTC and ships at most once a day, so a response cached with a fixed
duration is either stale past a release or re-fetched for nothing. The TTL is computed per write
as `next 00:00 UTC − now`: cache at 23:50 and it lives ten minutes, cache at 00:05 and it lives
just under a day. Either way the first reader after a release sees the release, and nobody pays
for a request that could not have new data behind it.

Two details that decide whether this holds up:

- The TTL is **clamped to a floor** of a minute or so. Written at exactly midnight it computes as
  zero or negative, which a KV put would reject or treat as immediate expiry, and the page would
  then hit the API on every request for that second.
- A failed or rate-limited fetch **serves the stale copy** rather than an error. GitHub allows 60
  unauthenticated requests an hour against an IP a Worker shares with others, so the failure is
  routine rather than exceptional; a token in a secret raises the ceiling, and the fallback is
  what makes the page's availability independent of GitHub's.

The store is a KV namespace reached through `@sdxc/cache`'s KV adapter, which is already a
package in this collection, and the date arithmetic belongs to `@sdxc/dates`, which is zone-aware
and therefore the right tool for "the next midnight in UTC".

### Prev/next pager

A rule, then two bordered cards of equal height: `PREVIOUS` with its title left-aligned, `NEXT`
right-aligned, both following sidebar order across guides and package references alike. At either
end the remaining card keeps its side and the empty slot stays empty, rather than one card
stretching across.

## Part 3 — Everything else the reference sites have

Surveyed live on 2026-09-21. Three findings shaped the plan above before the page list below.

**Code density on the landing page varies wildly.** Rails is the heaviest: four consecutive
filename-labeled snippets (`app/models/article.rb`, `app/controllers/articles_controller.rb`,
`app/views/articles/show.html.erb`, `config/routes.rb`) that walk a reader through MVC, each one
deliberately dense so every line demonstrates a different feature. Laravel shows exactly one
thing: an interactive editor mockup with eight feature tabs over two file tabs. TanStack's
homepage has **no code at all** — only type-signature chips — and saves every snippet for its
per-library pages. Sections 2 and 5 above sit between Laravel and Rails, which is the right
place for a collection whose pitch _is_ the code.

**All three now lead with agents, and two have shipped for them.** TanStack serves a `.md` twin
of every docs page, with an on-page banner announcing it and a **Copy page** button beside the
H1. Laravel mirrors its entire docs tree at `/framework/docs/13.x/<page>.md`. Rails only argues
the case, on an `/ai` page with a model benchmark. Here the source _is_ markdown, so shipping
the strongest version of this is serving a file that already exists.

**A philosophy page is 3-for-3.** Rails has `/doctrine` (nine numbered pillars), TanStack has
both `/ethos` and `/tenets` (the latter split by reader: evaluating, contributing, maintaining),
and Laravel's whole homepage is an argument about opinionation. All three link it from the
landing page rather than burying it in docs.

### Build

| Page                                         | Why                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/packages` and `/packages/:name`            | The reason the site exists. All three references have per-library pages.                                                                                                                                                                                                                                                                       |
| `/docs/*`                                    | Guides that no single README can hold, because they are about the set.                                                                                                                                                                                                                                                                         |
| Changelog                                    | Dated releases need a home: one entry per `v YYYY.M.D` tag, with its notes. Reads the GitHub Releases API into a KV cache that expires at midnight UTC. Rails and Laravel both have this; here it also _teaches_ the versioning scheme. Lives under Releases in the docs tree, beside Versioning.                                              |
| `/search`                                    | Sixty packages and a large README corpus are unusable without it — Rails Guides ships no search and it is that site's most obvious gap. A build-time index over headings and paragraphs, served as JSON, driven by `Command` with a `⌘K` binding. Laravel puts the box in the global header so it works from marketing pages too; do the same. |
| `/llms.txt`, plus a `.md` twin of every page | Follow TanStack and Laravel rather than inventing: `/docs/conventions.md` and `/packages/result.md` serve the source file, and every page carries a **Copy page** button. The file is already in the bundle, so the route is a lookup and a `text/markdown` response.                                                                          |
| `/sitemap.xml`, `/rss.xml`                   | `@sdxc/sitemap` and `@sdxc/feed` are in this very collection. Not using them here would be an argument against them.                                                                                                                                                                                                                           |
| `/security`                                  | Rails has one, and it is the page a person looks for before depending on anything: which releases get fixes, and how to report something privately. Short, and its absence is conspicuous.                                                                                                                                                     |
| `/maintenance`                               | Rails' maintenance policy page. Dated releases carry no compatibility promise, which is exactly why the support policy needs stating somewhere other than a README footer.                                                                                                                                                                     |
| `/philosophy`                                | Promoted from a maybe: all three references have one and all three link it from the landing page. Contents proposed below.                                                                                                                                                                                                                     |
| `/showcase`                                  | The apps built on the packages. Rails' framing — "study reference apps" — rather than a logo wall.                                                                                                                                                                                                                                             |
| Sponsors block                               | There are real GitHub Sponsors on `sergiodxa`. A named block plus a "Sponsor this work" link, in the footer and on `/philosophy`.                                                                                                                                                                                                              |
| MCP endpoint                                 | shadcn treats its MCP server as a product surface, and `@sdxc/mcp` is a package in this set. Package search and page fetch over content already in the bundle.                                                                                                                                                                                 |

### Skip

| Page                    | Why not                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| Contributors / team     | One contributor; a grid of one is worse than no grid                                                            |
| Companies using         | One user                                                                                                        |
| Download counters       | The packages are freshly bootstrapped; the number argues against adoption today                                 |
| Discord / community hub | No community to send anyone to; GitHub issues are the whole support surface                                     |
| Conferences / events    | Not applicable                                                                                                  |
| Blog                    | `sergiodxa.com` already exists and is the author's blog. Cross-link, don't fork it                              |
| Versioned docs          | Dated releases carry no compatibility promise, so "docs for v2" has no meaning. Docs describe `main` and say so |
| Playground / REPL       | Real value, but it needs a bundler in the browser; out of scope for v1                                          |

### Decide

| Page          | The question                                                                                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/docs` shape | Rails' `/docs` is a **hub, not an index** — six cards routing by intent. With guides, 60 package references and two catalogue sites under one roof, that framing probably beats a plain sidebar landing. |

**Dropped: `/stats`.** TanStack's works because the numbers are adoption numbers. Here they would
be download counts of one, so the page would argue against the packages. The repo-truthful
figures worth keeping — 60 packages, 32 with no dependencies, 38 framework-free — are already
section 3 of the landing page, which is where they do work.

### Sponsors, honestly

The sponsors are the author's, not the packages' — they predate this npm scope and they fund the
work broadly. So the block says that: **"People who fund this work"**, names and avatars from
GitHub, and one link to sponsor. No tiers, no perks table, no logo sizes. TanStack's
Gold/Silver/Bronze only makes sense at a volume that would be obvious if it existed.

Implementation: GitHub's GraphQL API, read with a token held as a Worker secret, through a small
client on `@sdxc/api-client`. The response is cached in KV via `@sdxc/cache` and refreshed on a
schedule declared with `@sdxc/jobs`, so a rate limit or an outage never costs the footer.

One detail that must be right: **private sponsors must never be rendered.** An owner-scoped token
can see them, so the query uses the public-only view and the mapping keeps only sponsors GitHub
marks public. A test covers it, because getting this wrong is a privacy incident, not a bug.

### `/philosophy` — what goes in it

The material already exists: 75 ADRs under `docs/adr/` are a written record of why these packages
look the way they do. Six pillars, each a pattern that recurs across many of them, each citable:

| Pillar                                              | What it says                                                                                                                    | Evidence                                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **1. Failure is a value**                           | Every fallible entry point answers with a `Result`. Nothing throws past you, and an error carries the position it happened at.  | `@sdxc/result`; every parser in the set                                                              |
| **2. The platform is the baseline**                 | `Request`, `Response`, Web Crypto, `Intl`, `<dialog>`, the Popover API. Reach for a shim only where the platform has no answer. | ADR-020 (Intl-only dates), ADR-023 (Web Crypto), ADR-022 (HTTP cache semantics)                      |
| **3. Implement the spec, don't invent one**         | Where a standard exists, follow it, so the knowledge transfers and the data interoperates.                                      | ADR-026 (Standard Webhooks), ADR-059 (OpenFeature), ADR-051/061 (Atom, JSON Feed), ADR-056 (sitemap) |
| **4. One contract, adapters at the edge**           | The recurring shape: a vendor-neutral core, the vendor behind a driver you can swap or fake.                                    | ADR-018 (mail), ADR-019 (rate limit), ADR-043 (billing), ADR-053 (cache), ADR-054 (jobs)             |
| **5. Own the core, depend at the rim**              | When a dependency would own a load-bearing concern, write it. 32 of 60 have no external dependency.                             | ADR-041 (XML), ADR-042 (highlighting), ADR-046 (frontmatter), ADR-047 (YAML), ADR-058 (markdown)     |
| **6. The framework is a subpath, not a foundation** | The core works anywhere `fetch` does; the Remix binding is an export you opt into. 38 of 60 need no framework.                  | ADR-048 (auth core independent of Remix), ADR-057 (request context replacing the service container)  |

A seventh, which is really the page's closing note: **the reversals are published too.** ADR-008
adopted a service container; ADR-057 removed it. ADR-007 replaced its own earlier proposal in
place. The log is not a highlight reel, and linking it is the point — someone deciding whether to
depend on this can read every decision and every retraction.

The page ends by linking `docs/adr/` on GitHub, with the sponsors block beneath it.

### `/showcase` — the apps, with the receipts

Five apps, listed because they are the ones worth showing. The monorepo holds more, and the
showcase is curated rather than exhaustive — `r3-gallery` at four packages and `pkmn` at one
prove nothing, and listing them would dilute the ones that do.

| App         | `@sdxc` packages | Where                  |
| ----------- | ---------------- | ---------------------- |
| `uptime`    | 32               | `uptime.sergiodxa.com` |
| `auth-saas` | 30               | Source only            |
| `reader`    | 29               | Source only            |
| `blog`      | 23               | `sergiodxa.com`        |
| `books`     | 13               | `books.sergiodxa.com`  |

Counts are each app's `@sdxc/*` dependencies, read from its manifest.

The valuable part is that this is **bidirectional and generated**: an app page lists the packages
it uses, and every package reference page gains a "used by" line naming the apps that depend on
it. Both read from the manifests, so neither can go stale.

The "used by" line reads **this same curated set**, not every workspace. A package page that
claims five users while the showcase lists five apps is consistent; one that counts nine and
links five is a reader noticing the discrepancy before anything else on the page.

Apps that are source-only are labelled that way rather than hidden — unshipped code is still
readable code, and quietly implying a deployment would be the same dishonesty as a logo wall.

---

## Consequences

### Positive

- The landing page is a markdown file. The pitch changes in one file, with no view code touched.
- Package descriptions on the site cannot drift from the manifests, because they are read from them.
- The site dogfoods `markdown`, `highlight`, `ui`, `u`, `http`, `sitemap`, `feed`, `seo` and
  `workers-cache`. Every rough edge in those packages surfaces here first.

### Negative

- 1.6 MB of README text lands in the Worker bundle. Compressed it is comfortable, but it grows
  with every package and needs watching.
- `packages/*/README.md` becomes published UI. A README written for npm now also has to read
  well inside a docs shell — most already do, and `@sdxc/u` demonstrably does not.
- The site is coupled to the monorepo layout: it globs across workspace boundaries and cannot
  be extracted without changing how it reads content.

### Neutral

- Guides live in `apps/sdxc/resources/docs`, package reference lives beside the code. Two homes
  for documentation, split by who owns the sentence.

---

## Implementation plan

### Phase 0 — Scaffold

App from the `create-app` skill, `wrangler.jsonc`, `routes/web.ts`, document layout, theme, and
`@sdxc/ui` + `@sdxc/u` wired.

### Phase 1 — The markdown landing

`content/home.md`, the tag set and its components, `package-groups` reading the manifests, the
highlight and anchor visitors. This phase alone is a shippable site.

### Phase 2 — Guides

`resources/docs`, the docs service ported from `apps/uptime`, the sidebar, and the Getting
started and Conventions sections written.

### Phase 3 — Package reference

`/docs/packages` index with filtering, `/docs/packages/:name` from README, the manifest header,
the generated "used by" line, in-page table of contents, and relative-link rewriting.

### Phase 3b — The two catalogue sites

`@sdxc/jsdoc` first, since both trees read its output — and this site is its first real
consumer, so the two land together. Then
`/docs/packages/u/*` on Tailwind's page skeleton — generated quick-reference tables, the States
and Responsive reference pages — and `/docs/packages/ui/*` on shadcn's, with server-rendered
previews, generated props tables and composition trees, plus the theming page. This is the
largest phase by some distance, and it ships one package, then one family at a time.

### Phase 4 — Discovery

`/search` with its build-time index and a global-header `⌘K`, the `.md` twin route plus its
**Copy page** button, `/llms.txt`, the MCP endpoint on `@sdxc/mcp`, `/sitemap.xml`, `/rss.xml`,
and SEO metadata via `@sdxc/seo`.

### Phase 5 — Release and policy surface

`/releases` against the GitHub Releases API, `/security` and `/maintenance`.

### Phase 6 — Philosophy, showcase, sponsors

`/philosophy` from the six pillars, `/showcase` from the manifests, and the sponsors block with
its cached GitHub query and its public-only test.

## Decisions taken while unattended

These were the open questions. Each is resolved, with the reasoning, so any of them can be
reopened by reading why it went the way it did.

**`/philosophy` is a root page, not a docs page.** Rails, TanStack and Laravel all keep theirs at
the root and link it from the landing. It is an argument, not a reference, and burying an
argument under `/docs` tells a reader it is optional reading.

**`/docs` is an intent-routing hub, in Rails' style.** A plain sidebar index works when there is
one kind of content. This tree holds guides, sixty package references and two catalogue sites, and a
reader arriving at `/docs` wants one of a small number of different things. Six cards beat a
sidebar with three hundred leaves.

**The landing page does not raise the adoption question.** The earlier draft asked whether to
state "one author, one user, use at your own risk". It should not. The packages are real, they
run five deployed and source-available applications, and the showcase says so with counts a
reader can check. An unprompted apology invites a doubt the reader did not arrive with, and the
honesty is already carried by what the site declines to claim: no logo wall, no download counter,
no contributor grid.

**The catalogues generate completely in v1.** All 293 utility pages and all 100 component pages
ship with their generated reference — quick-reference tables, props tables, composition trees.
Generation is the cheap half and it is now proven over the whole corpus with zero failures, so
holding pages back would trade a real benefit for no saving. Hand-written examples are added
only where a page is confusing without them, which is the one part that costs time per page.

## Open questions

None blocking. Two worth revisiting once the site is running:

1. Whether `@sdxc/jsdoc` should grow an option to report non-exported declarations, which would
   let the props tables resolve a default like `DEFAULT_COLOR` to `"neutral"` instead of showing
   the link text. It is a contract change, so it wants a second consumer asking for it.
2. Whether the utility examples that stand alone rather than pairing should be normalized in
   `@sdxc/u`'s own JSDoc instead of handled by a rule in the site's build step.
