# AGENTS.md — sdxc-site

Instructions for working in this app. The root `AGENTS.md` still applies; this file
covers what is specific to a site whose pages are markdown rather than views.

## What this app is

The public face of the published `@sdxc/*` packages. Its landing page is one markdown
file rendered through a fixed tag vocabulary, and its package list is read from the
workspace manifests. Nothing here is behind a login and nothing here writes.

## Things that cannot change

- **`sdxc.dev` and `sdxc.sergiodxa.com`** are custom domains declared in `cloudflare.config.ts`.
  A deploy that drops one takes that address offline; rollback is redeploying the previous
  version. `SITE_URL` in `config/constants.ts` is `sdxc.dev`, and the `canonical-host` middleware
  redirects a `GET` on a former host there while letting webhooks and MCP posts through.
- **The tag names in `app/services/content.ts`** are the vocabulary every content file is
  written in. Renaming one silently turns every use of it into raw HTML text, because an
  unregistered element is left alone by the parser.

## Rules

- **Parse markdown per request.** Work in the worker's global scope fails upload
  validation, and a dry run does not catch it. A content file is imported as a string;
  `readContent` is what turns it into a document, inside a request.
- **Register a tag before using it**, with an attribute schema built from
  `remix/data-schema`. The schema is the whole reason a typo in a content file fails
  loudly with a line number.
- **Put the copy in the content file, not in a component.** A component decides how
  something is drawn; the markdown decides what it says and where it links.
- **Count rather than write a number down.** A claim about the collection is a
  `{% $name %}` hole resolved from the manifests in `app/services/packages.ts`.
- **A new package needs no code.** Add its directory to the right group in
  `resources/content/groups.ts`; one that is missing from every group still appears, under
  the trailing group, rather than disappearing.
- **A new guide is one file.** Write it under `resources/docs/` with the frontmatter the
  schema in `app/services/docs.ts` holds it to; the sidebar, the hub and the route all
  read from the file. Its code samples are formatted at 86 columns with four-column tabs
  (a `fmt.overrides` entry in the root `vite.config.ts`), the width a guide's code column
  shows without scrolling, so `bun check:fix` keeps them fitting. A guide may not be filed
  under `packages`: `/docs/packages/*` is where the package reference used to live, and it
  redirects to `/api`.
- **Every guide meets one bar.** The guides in `resources/docs/sdxc/` set it, and a guide in
  any section has the same parts:
  - Frontmatter with `title`, a one-sentence `description`, `section`, `order`, `lastUpdated`
    and three `outcomes`, each a line starting "How to", "What", "When", "Where" or "Why".
  - An opening paragraph, before any heading, that names the problem and what the reader
    ends up with, then the install line for every package the code imports.
  - Steps as `##` headings phrased as what the reader does, each with a code sample that
    imports what it uses and carries `{% title="…" %}` naming the file it belongs in, at its
    app-layout path (`app/services/…`, `app/http/controllers/…`).
  - A section that tests what the guide built, through the app's router, the package's own
    testing entry or MSW, whenever the guide writes code an app runs.
  - A `> [!NOTE]` or `> [!WARNING]` alert for each constraint a reader would otherwise
    learn in production: a limit, an ordering requirement, a security consequence. Every
    content file writes asides as GitHub alerts (`NOTE`, `TIP`, `IMPORTANT`, `WARNING`,
    `CAUTION`), which `resources/components/alert.tsx` draws with a label and an icon.
  - `## Where to go next`, last, with two or three links and a phrase on why to follow each.
  - Second person, affirmative, the reason before the flag or option, current APIs only.
    The schema and `app/http/controllers/docs.test.ts` hold the parts a machine can check.
- **Each part of the site draws its own sidebar.** `/docs` holds the guides, `/api` every
  package but `u` and `ui`, and `/api/u` and `/api/ui` each hold their own catalogue. The
  builders are in `app/services/navigation.ts`; a page picks the one for the path it
  answers, and the pager steps only through that tree.
- **A new `@sdxc/ui` mixin, behavior, animation or style needs no code.** The extractor
  reads every module its subpath's barrel forwards, gives each export of that subpath's
  kind a page, and files the events, constants and types beside it on that page. A
  documented subpath is one entry in `app/services/ui-subpaths.ts`.
- **A guide documents the packages and how they meet Remix, not Remix itself.** Show a
  Remix API only where a package step builds on it — the schema `@sdxc/validate` checks, the
  route a handler is mapped to — and leave a Remix feature a package does not touch (the
  renderer, `cop`, cookies, the data-table query API) to Remix's own documentation.
- **Name a tab strip only where the choice repeats.** A strip that names an option group
  from `app/services/option-groups.ts` shares one selection with every other strip naming
  it, site-wide, and labels its tabs with that group's options. Adding a group is adding it
  there, which is also what holds a cookie written by the browser to what the site offers.
- **Never invent a sponsor.** `/sponsors` and `/philosophy` name people, so they render
  only what GitHub answered with, read through the public-only view. A read that fails or
  returns nobody draws no list at all: there is no sample list, no placeholder and no
  fallback name, and `app/services/sponsors.test.ts` is what holds that.
- **Rewrite a README's links, never its text.** A package README is read on npm and on
  GitHub too, so what makes it read correctly here is the link handler in
  `app/services/article.ts`.
- **A `@sdxc/u` example is one file.** Write it as
  `resources/components/utility-examples/<utility>/<NN>-<slug>.tsx`, default-exporting a
  `UtilityExampleModule`; the page and its twin read the `title` and `description` string
  literals and the `render` body from the file's text, and its frame renders the module at
  `/frames/u/<utility>/<slug>`. Decoration goes through `demo.*`, which the printed code shows
  as `...`, so the code reads as the utility it teaches. `app/services/utility-examples.test.ts`
  fails while a published utility has no example.
- **Every page keeps its markdown twin.** `/docs/<slug>.md` and `/api/<name>.md`
  serve the source file; a catalogue page's twin (`/api/u/<utility>.md`,
  `/api/ui/<component>.md`, `/api/ui/<subpath>/<slug>.md`) is written by
  `app/services/catalogue-markdown.ts` from the same record its HTML page draws. The
  `Open` menu, `/llms.txt`, the search index and the MCP resources all address a page by
  that URL. A page whose twin stopped answering breaks all four at once.
- **Enumerate the catalogues through `listCataloguePages`.** `app/services/catalogue-pages.ts`
  is the one list of every `@sdxc/u` utility and every `@sdxc/ui` theme, component and
  subpath page that search, `/llms.txt`, the sitemap and the MCP resources read, so a page
  added to either catalogue reaches all four.
- **One search index serves everything.** The search dialog, `/search`, `/search.json` and
  the MCP `search_docs` tool read `app/services/search.ts` and rank through
  `app/services/search-query.ts`, so a reader and a model are answered in one order. The
  search syntax (`kind:guide`, `-word`, `a OR b`, `"phrase"`) is read there too, by
  `parseSearch`, so a filter typed in the dialog means the same thing to the tool. The
  index is built once per isolate from the same parse and heading anchoring the pages
  render (`anchorArticle`, `anchorPackageReadme`), so a result's fragment always exists.
- **There is one search dialog.** It lives in the site header, holds `⌘K`, and covers the
  guides and every package together. A page wanting search opens `SEARCH_DIALOG_ID` rather
  than standing up a second one, which would take the same binding.
- **The search dialog is a frame.** The header renders a trigger linking to `/search` and a
  dialog holding `<Frame src="/frames/search">`; the box island reloads that frame as the
  reader types, so ranking, tabs and limits are decided on the server and the island knows
  nothing about what it searches.
- **A frame route streams its render.** A page inlines only the first chunk of a blocking
  frame's body, so a frame controller returns `ctx.render(…)` as is; `withBundleCache`
  rebuilds the body from a string, which workerd then reads in 4 KB pieces, and the page
  would show the rest as text.
- **Build a URL a machine will read from `SITE_URL`.** A sitemap, a feed, an `llms.txt`
  entry and an MCP resource URI are identities rather than links, so they name one origin
  regardless of which host answered.

- **Link assets through the manifest.** The router's `assets()` middleware resolves the
  document's stylesheets and client entry through `assetResolver` in
  `app/initializers/assets.ts`, which reads the manifest `@pitlane/vite-plugin-remix` writes,
  and publishes them as `ctx.assets`; every page renders `<DocumentLayout assets={ctx.assets}>`.
  A build hashes every file, so a hand-written `/assets/...` URL names a file the next build
  renames. A stylesheet joins by a side-effect
  `import "….css"` in `resources/layouts/document.tsx`, in cascade order.
- **Keep only islands in the browser entry.** `bootstrap/browser.ts` globs
  `resources/components/previews/` and names each other `clientEntry()` module; a new island
  elsewhere is one more line there, and `bootstrap/browser.test.ts` fails until it is added.
  A layout or view in the client bundle compiles the document's stylesheets a second time,
  and every page would link both copies.

## Reference files

| Concern                                               | File                                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| The tag vocabulary and parse                          | `app/services/content.ts`                                                    |
| Manifests and their grouping                          | `app/services/packages.ts`                                                   |
| The landing copy                                      | `resources/content/home.md`                                                  |
| The group taxonomy                                    | `resources/content/groups.ts`                                                |
| The guides and their sections                         | `app/services/docs.ts`, `resources/docs/`                                    |
| The four sidebars and the pager's order               | `app/services/navigation.ts`                                                 |
| The shared markdown pass, and the link rewriting      | `app/services/article.ts`                                                    |
| The applications the showcase and a package page name | `resources/content/apps.ts`, `app/services/showcase.ts`                      |
| Who funds the work, and where the list is kept        | `app/services/sponsors.ts`, `app/http/controllers/sponsors.tsx`              |
| The cache policy a documentation page carries         | `app/http/caching.ts`                                                        |
| The named option groups and their cookie              | `app/services/option-groups.ts`, `app/initializers/cookies.ts`               |
| The `@sdxc/ui` subpath pages and how a module is read | `app/services/ui-exports.ts`, `scripts/ui-exports.ts`                        |
| The `@sdxc/u` examples, and how their code is read    | `resources/components/utility-examples/`, `app/services/utility-examples.ts` |
| The theme scales a utility page teaches               | `app/services/utility-theme.ts`                                              |
| The components per tag                                | `resources/components/`                                                      |
| The palette the theme reads                           | `resources/css/colors.css`                                                   |
| Built asset URLs (manifest)                           | `app/initializers/assets.ts`                                                 |
| The site's one origin, and its head metadata          | `config/constants.ts`, `app/initializers/seo.ts`                             |
| The search corpus and its ranking                     | `app/services/search.ts`, `app/services/search-query.ts`                     |
| What the `Open` menu offers                           | `app/services/open-links.ts`                                                 |
| The markdown map a model reads                        | `app/services/llms.ts`                                                       |
| What the MCP endpoint declares, and what answers it   | `app/mcp/tools/`, `app/mcp/resources/`, `app/initializers/mcp.ts`            |
