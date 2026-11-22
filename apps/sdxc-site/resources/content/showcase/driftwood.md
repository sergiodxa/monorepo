---
title: Driftwood
headline: Content docs that route a reader by task, remember their setup and work before any script loads
summary: Docs for an invented static-site deploy CLI, written as a tutorial, how-to guides and concept pages on the @sdxc/ui docs kit.
cover: hub
shots:
  - id: hub
    page: ""
    alt: The Driftwood docs hub, with three start cards, a row of topics and the three sections with their page counts.
  - id: file-tree
    page: "start/quickstart"
    highlight: "[data-slot='file-tree']"
    alt: A file tree of the project the tutorial creates, with driftwood.toml marked as written by init beside two HTML pages and an assets folder.
  - id: dns-tabs
    page: "guides/custom-domains"
    highlight: "[data-slot='code-tabs']"
    alt: DNS records in tabs for Cloudflare, Route 53 and a zone file.
  - id: rail
    page: "concepts/how-deploys-work"
    highlight: "[data-slot='docs-rail']"
    alt: The On this page rail beside a concept page, listing Build, Upload what changed, Switch traffic and Roll back.
  - id: feedback
    page: "guides/custom-domains"
    highlight: "[data-slot='docs-feedback']"
    alt: The Was this page helpful block at the foot of a guide, with yes and no choices.
  - id: search
    page: "search?q=deploy"
    highlight: "[data-slot='docs-article']"
    alt: The search page for the word deploy, with matching page titles and leads and the matched word marked.
  - id: not-found
    page: "guides/custom-domain"
    highlight: "[data-slot='docs-not-found']"
    alt: A 404 page for a mistyped guide address, showing the path, a search box filled with custom domain, and three pages to start from.
  - id: phone
    page: "start/quickstart"
    viewport: phone
    alt: The quickstart tutorial on a phone, with the sidebar folded behind a menu button and the steps in one column.
---

Driftwood is an invented command line that deploys static sites to the edge, and this is its documentation: seven pages split into a tutorial, three how-to guides and two concept pages, with a hub at the root, a search page and a not-found page. The product is invented; the site is real, and it shows what the `@sdxc/ui/docs` kit builds when the content is prose a reader follows, finishes or tries to understand.

Of the four docs demos, Driftwood carries the least besides the frame, which makes it the clearest place to read the frame itself. Every docs demo renders inside the same shell (header, sidebar, rail, page header, pager, feedback, search and Markdown twins), and here that shell is the subject. It is set in stone neutrals with a terracotta accent, serif headings over a sans body, and soft corners, all through theme tokens on one wrapper.

The two things worth a developer's time are how much of it works with scripts off, and how the site remembers a reader's choices on the server, so a page never renders one package manager and then flips to another.

## The brief

Developer docs have to serve two readers at once: the one arriving cold who needs a path, and the one coming back for a single fact. They have to split content by what the reader is doing, because a tutorial, a how-to guide and an explanation fail when mixed on one page. They need search that answers, a table of contents that knows where you are, code that matches the reader's setup, and a dead end that is never a dead end.

Driftwood takes all of that on with a deliberately small product. The tree has three sections, Get started, Guides and Concepts, and each page belongs to exactly one kind. The tutorial walks from install to a public URL; each guide is titled as the task it finishes; each concept page explains the why the guides rely on. Every page is a `DemoDocsPage` record in `resources/views/demo-docs/driftwood/`, holding a title, a lead, a last-updated date, its headings for the rail and search, hand-written next steps, and a render function.

The site record in `driftwood/index.tsx` adds the product's name, mark, palettes, tree and hub. Nothing else is Driftwood-specific: the hub, search, not-found page, article frame and feedback are shared modules beside it.

## A hub and a tutorial that start a reader moving

The root is a [DocsHub](/api/ui/docs-hub) titled "Ship a static site in one command". Three start cards are labelled by the kind of page they open (a five-minute tutorial, a how-to, a concept), a topic row links straight to custom domains, previews, environment variables and the cache headers anchor, and each section lists its page count. A newcomer takes the first card; a returning reader takes a topic.

The tutorial, "Deploy your first site", is a [Steps](/api/ui/steps) list of four: install the CLI, log in, create a project, deploy it. Install is an [InstallCommand](/api/ui/install-command), the same line in each package manager, and the create step shows the folder after `driftwood init` as a [FileTree](/api/ui/file-tree): two HTML pages, an `assets/` folder and the new `driftwood.toml`, marked with the comment "written by init" so the reader sees exactly what the command added. The "Project layout" page picks up from there, with one section each for `driftwood.toml`, `public/` and `functions/`.

![A file tree of the project the tutorial creates](/showcase/driftwood/file-tree.webp "The tutorial shows the folder after init as a tree, the one new file marked with a comment.")

The install line uses `persist="cookie"`. The choice of npm, pnpm, Yarn or Bun is written to a cookie, the controller reads it with `readCodeTabsCookie`, and each page's render function receives a `tab(syncKey)` reader, so the server renders the reader's last choice on every page. The page cache varies on that cookie, so a cached page never shows someone else's pick.

```tsx
export function Install(handle: Handle<Install.Props>) {
	return () => (
		<InstallCommand
			{...handle.props}
			persist="cookie"
			title="Terminal"
			labels={CODE_LABELS}
			aria-label="Package manager"
		/>
	);
}
```

## Guides with code that fits the reader's setup

"Add a custom domain" is a guide in three steps, then a troubleshooting section with two named failures: the domain does not resolve, and the certificate stays pending. Its DNS records sit in [CodeTabs](/api/ui/code-tabs) with one tab each for Cloudflare, Route 53 and a zone file. The tabs share the sync key `driftwood-dns` with `persist="local"`: once the page's script has loaded, choosing Route 53 switches every DNS example on the page and the browser remembers it for the demo's other pages. Before that, the tabs are radio inputs and switch with CSS alone.

![DNS records in tabs for Cloudflare, Route 53 and a zone file](/showcase/driftwood/dns-tabs.webp "One sync key ties every DNS example together, so a reader picks their provider once.")

"Preview every pull request" does the same with CI, showing the workflow for GitHub Actions and GitLab CI under `driftwood-ci`, and carries a New badge in the sidebar. "Use environment variables" ends with a [PropsTable](/api/ui/props-table) of the built-in variables a function can read. Notes and warnings are [Callout](/api/ui/callout) blocks through a small `Aside` wrapper that sets its content as one paragraph, so inline code such as a flag name stays inside its sentence.

## A frame that knows where the reader is

Every page sits in a [DocsLayout](/api/ui/docs-layout). On the left is a [DocsNav](/api/ui/docs-nav) with a page filter and a "Search the docs" link in its foot; under the md breakpoint the sidebar folds into a drawer opened by a native `<dialog>`. The article opens with a [DocsPageHeader](/api/ui/docs-page-header): a breadcrumb to the section, the title, the lead, the last-updated date and [PageActions](/api/ui/page-actions).

On the right, the "On this page" rail lists the page's headings from the same `toc` array search reads, and its marker follows the heading being read. The concept pages, "How a deploy works" and "Caching and invalidation", are where it earns its place: each section (build, upload what changed, switch traffic, roll back) is one step of the explanation.

![The On this page rail beside a concept page](/showcase/driftwood/rail.webp "The rail lists the same headings search reads, and its marker follows the section in view.")

Under the body come [NextSteps](/api/ui/next-steps), written per page, and a [DocsPager](/api/ui/docs-pager) that stays inside the page's section. The pager reads its neighbours with `findNeighbours(tree, path, { boundary: "section" })`, so the last guide hands the reader to the concepts through its next steps and the pager stops at the section's edge.

On a phone the header keeps one row: the search box folds into a search link under 40rem, and the product name drops its "Docs" label under 24rem. The sidebar and the rail move into a bar under the header: a Menu button that opens the drawer, and an "On this page" disclosure that names the section being read beside a ring that fills as the reader scrolls.

![The quickstart on a phone](/showcase/driftwood/phone.webp "On a phone the sidebar becomes a Menu button and the rail a bar naming the section in view.")

PageActions copies the page as Markdown or opens it at `<page>.md`. Every page has that twin, served as `text/markdown` from the same page record, so a reader can hand a page to an assistant in one click.

## Feedback in its own frame

"Was this page helpful?" is a [DocsFeedback](/api/ui/docs-feedback) form, served from its own frame under the demo's `frames` path and placed in the [DocsFooter](/api/ui/docs-footer). The page inlines the frame on the server, so the form reads and posts with scripts off. With the runtime, a vote reloads only the frame and swaps the form for the thanks, and the reader keeps their scroll position. The page and the vote cache apart, so the article stays cached for everyone while one reader's vote changes only their frame.

![The Was this page helpful block](/showcase/driftwood/feedback.webp "The feedback form is its own frame, inlined on the server and reloaded alone after a vote.")

## Search and a not-found page that both answer

The header's search box is a plain GET form to `search?q=`. `searchDemoDocs` in `app/services/demo-docs-search.ts` matches every word of the query against each page's title, lead and headings, ranks title matches first, links straight to a matching section when the hit is only in a heading, and splits the matched text into segments that [Highlight](/api/ui/highlight) marks. A query under two characters lists nothing.

![The search page for the word deploy](/showcase/driftwood/search.webp "Search matches titles, leads and headings, ranks titles first and marks every hit.")

An address no page answers renders [DocsNotFound](/api/ui/docs-not-found) with a 404 status. It prints the address that missed, turns its last segment into words with `searchQueryFromPath` and fills the search box with them, then offers three pages to start from, so `guides/custom-domain` arrives with "custom domain" already typed and "Add a custom domain" one click away.

![A not-found page for a mistyped guide address](/showcase/driftwood/not-found.webp "A mistyped address becomes a search, filled in from the path.")

## Takes after

- [Vercel docs](https://vercel.com/docs) — a deploy CLI documented around a preview URL for every branch; Driftwood keeps that guide and gives it a CI tab per provider.
- [Netlify docs](https://docs.netlify.com) — custom domains and environment variables as one task per page; Driftwood closes its domain guide on named failures.
- [Cloudflare Workers docs](https://developers.cloudflare.com/workers/) — concept pages beside the how-to guides that explain what happens between a deploy and its first visitor.

## Where to start reading

- [`resources/views/demo-docs/shell.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-docs/shell.tsx) — the header, layout, article frame and footer every docs demo renders in.
- [`resources/views/demo-docs/driftwood/index.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-docs/driftwood/index.tsx) — the site record: theme tokens, tree, hub and pages.
- [`app/services/demo-docs-search.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/app/services/demo-docs-search.ts) — search over titles, leads and headings.
