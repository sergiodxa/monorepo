# AGENTS.md — sdxc

Instructions for working in this app. The root `AGENTS.md` still applies; this file
covers what is specific to a site whose pages are markdown rather than views.

## What this app is

The public face of the published `@sdxc/*` packages. Its landing page is one markdown
file rendered through a fixed tag vocabulary, and its package list is read from the
workspace manifests. Nothing here is behind a login and nothing here writes.

## Things that cannot change

- **`sdxc.sergiodxa.com`** is a custom domain declared in `cloudflare.config.ts`. A deploy that
  drops it takes the site offline; rollback is redeploying the previous version.
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
- **Never invent a sponsor.** The block names people, so it renders only what GitHub
  answered with, read through the public-only view. A read that fails or returns nobody
  draws no block at all: there is no sample list, no placeholder and no fallback name,
  and `app/services/sponsors.test.ts` is what holds that.
- **Rewrite a README's links, never its text.** A package README is read on npm and on
  GitHub too, so what makes it read correctly here is the link handler in
  `app/services/article.ts`.
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
- **One search index serves everything.** The palette, `/search.json` and the MCP
  `search_docs` tool read `app/services/search.ts` and rank through
  `app/services/search-query.ts`, so a reader and a model are answered in one order. The
  index is built by a line scan and held per isolate, never parsed per request.
- **There is one palette.** It lives in the site header, holds `⌘K`, and covers the guides
  and every package together. A page wanting search opens `SEARCH_DIALOG_ID` rather than
  standing up a second one, which would take the same binding.
- **Build a URL a machine will read from `SITE_URL`.** A sitemap, a feed, an `llms.txt`
  entry and an MCP resource URI are identities rather than links, so they name one origin
  regardless of which host answered.

## Reference files

| Concern                                               | File                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| The tag vocabulary and parse                          | `app/services/content.ts`                                     |
| Manifests and their grouping                          | `app/services/packages.ts`                                    |
| The landing copy                                      | `resources/content/home.md`                                   |
| The group taxonomy                                    | `resources/content/groups.ts`                                 |
| The guides and their sections                         | `app/services/docs.ts`, `resources/docs/`                     |
| The four sidebars and the pager's order               | `app/services/navigation.ts`                                  |
| The shared markdown pass, and the link rewriting      | `app/services/article.ts`                                     |
| The applications the showcase and a package page name | `resources/content/apps.ts`, `app/services/showcase.ts`       |
| Who funds the work, and where the list is kept        | `app/services/sponsors.ts`, `app/http/middleware/sponsors.ts` |
| The cache policy a documentation page carries         | `app/http/caching.ts`                                         |
| The named option groups and their cookie              | `app/services/option-groups.ts`, `app/http/cookies.ts`        |
| The `@sdxc/ui` subpath pages and how a module is read | `app/services/ui-exports.ts`, `scripts/ui-exports.ts`         |
| The components per tag                                | `resources/components/`                                       |
| The palette the theme reads                           | `resources/css/colors.css`                                    |
| The site's one origin, and its head metadata          | `app/services/site.ts`                                        |
| The search corpus and its ranking                     | `app/services/search.ts`, `app/services/search-query.ts`      |
| What the `Open` menu offers                           | `app/services/open-links.ts`                                  |
| The markdown map a model reads                        | `app/services/llms.ts`                                        |
| What the MCP endpoint declares, and what answers it   | `app/mcp/`, `bootstrap/mcp.ts`                                |
