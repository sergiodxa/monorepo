---
title: Saltbox
headline: A classic two-column blog, masthead, excerpts and sidebar widgets, rebuilt with today's craft
summary: A personal blog by an invented backend engineer about Go, Postgres and self-hosting, laid out like the default blog themes of the 2010s on @sdxc/ui.
tagline: The classic blog layout, rebuilt
accent: "oklch(0.52 0.155 28)"
cover: home
shots:
  - id: home
    page: ""
    alt: The Saltbox home, a site title and tagline over a band of red saltbox houses, a nav bar, the featured post and a sidebar of widgets.
  - id: featured
    page: ""
    highlight: "[data-slot='featured-post']"
    alt: The featured post at the top of the home, tinted and pinned, with its kind, title, Posted on line, excerpt, Continue reading link and tags.
  - id: sidebar
    page: "?type=notes"
    highlight: "[data-slot='sidebar']"
    alt: The sidebar beside the Notes category, stacking search, about the author, recent posts, categories with counts, a tag cloud, monthly archives and subscribe.
  - id: series
    page: "tutorials/caddy-in-front"
    highlight: "[data-slot='series-box']"
    alt: A tutorial's series box saying it is part 2 of 3 in Self-hosting a Go service, listing every part with the current one in bold and a link to the next.
  - id: author-box
    page: "articles/pooling-from-the-go-side"
    highlight: "[data-slot='author-box']"
    alt: The foot of an article, with its tags, the author box, previous post navigation, related posts and a Comments are closed note with a reply by email link.
  - id: archive
    page: "archive"
    highlight: "[data-slot='archive-list']"
    alt: The archives page, with a type filter and every post grouped by year and month, each row a date, a title and its kind.
  - id: not-found
    page: "articles/pooling-in-go"
    highlight: "[data-slot='not-found']"
    alt: A 404 page naming the missed address, a search box filled with pooling in go, and the five latest posts to start from.
  - id: phone
    page: ""
    viewport: phone
    alt: The Saltbox home on a phone, the masthead and band above a nav bar folded into a menu button, with the type filter and featured post in one column.
---

Saltbox is an invented personal blog by Wren Halloran, a backend engineer in St. John's, Newfoundland, who writes about Go, Postgres and running services on servers she can SSH into. It has nineteen posts across five kinds: four articles, four tutorials (three of them a series on self-hosting a Go service), four notes, three links and four glossary terms, and every one of them lives in one feed at the root.

Of the four blog demos, Saltbox is the one that looks like what most people still picture when they hear "a blog": a site title and tagline over a header image, a horizontal nav bar, posts as excerpts with a "Posted on" line and "Continue reading", and a sidebar of widgets down the right. It evokes the default blog themes of the 2010s without copying any of them, and it is built from the same `@sdxc/ui` kit as the rest of the showcase: a white page, a brick-red accent, Georgia for reading and a system sans for everything around it.

## The brief

The demo blogs share one contract. The root is a single mixed feed of every kind in date order, `?type=` narrows that same feed, and there are no per-kind index pages: a bare `/articles` redirects to `/?type=articles`. Each blog draws every page the controller can ask for, the feed, a post, the archive, the topics index, a tag, search, about, subscribe and a not-found page, in its own direction.

Saltbox's direction is the classic layout, done with today's craft. That means keeping the pieces readers already know how to use, the masthead, the nav bar, the excerpt loop, the sidebar widgets, the author box and "Previous post / Next post", while fixing what made the originals age badly: fixed widths, image-only headers, widgets that pushed content off a phone, and comment forms nobody moderated.

The site record in `saltbox/index.tsx` names the kinds, the tags, the author and the theme tokens. The frame, the loop and the widgets are three files beside it, and every page is drawn in `pages.tsx` from those parts.

## A masthead with a header band drawn in CSS

The masthead sets the site title large in the interface sans, the tagline in italic Georgia under it, and the mark, a small saltbox house, beside both. The title is a paragraph rather than a heading, so every page keeps its own title as its one `h1`.

Under it sits the header band, the place a 2010s theme put a 1000-pixel photograph. Here it is a row of three saltbox houses drawn entirely in CSS: each house is a `clip-path` polygon with the long, lopsided roof the style is named for, its clapboard siding a repeating gradient, its two windows two more gradient layers positioned on top, and a low sun a radial gradient in the sky. Every colour reads from the brand palette, so the band themes with the blog and costs no image request. In dark mode the sky turns to night, the sun becomes a moon, and the windows stay lit.

The nav bar below is the landing kit's [SiteHeader](/api/ui/site-header), with "Home" in its brand slot, each kind's feed and the archives and about pages as links, search and RSS as icon tools and Subscribe as its button. It sticks to the top as the masthead scrolls away, and on a phone it folds into a menu button that opens a sheet.

## The loop: one shape per post, the same frame for all

Every post in the feed has the classic shape: a kind label, a title, a meta line reading "Posted on November 4, 2026 by Wren Halloran in Articles", the body, and a "Tagged" line. Each part of the meta line links where a reader expects: the date to the permalink, the name to the about page, the kind to the feed narrowed to it. What changes from kind to kind is the body.

An article or tutorial shows its lead as an excerpt in the reading serif and a "Continue reading →" link that names the post to a screen reader, so a page of them never reads as six identical links. A note shows in full, through the shared `PostBody`, because a note is short enough to read on the front page. A link points its title straight at the page it saves, with an arrow and a "Visit postgresql.org ↗" line beside "Why I saved it". A glossary term reads as a definition, its one-sentence description set in italic against a rule.

On the first unfiltered page, the newest featured post leads the loop as a sticky post: tinted, ruled down its leading edge and pinned with a "Featured" [Badge](/api/ui/badge). The loop below skips it, so it is never listed twice.

![The featured post at the top of the home](/showcase/saltbox/featured.webp "The featured post leads the first page, tinted and pinned, and the loop below skips it.")

A row of filters with counts sits above the loop, from "Everything (19)" to "Glossary (4)". Choosing one turns the home into a category page with its own header and description, the way a classic theme titled a category archive. Paging is two words rather than numbers: "← Older posts" on the left, "Newer posts →" on the right and "Page 1 of 4" between them, built from [Pagination](/api/ui/pagination).

## A sidebar of widgets that knows its place

The sidebar is where classic blogs got cluttered, so Saltbox keeps the widgets readers actually use and stops there. Search is a GET form, so a result page is an address to share. About the author pairs an [Avatar](/api/ui/avatar) with a short bio. Recent posts lists the five newest. Categories lists each kind with its count and links to the feed narrowed by `?type=`. The tag cloud sizes each tag between two bounds by how many posts carry it, and spells the count out for screen readers. Archives lists every month with posts, each linking to that month's heading on the archive page. Subscribe offers the newsletter and the feed as two buttons.

![The sidebar beside the Notes category](/showcase/saltbox/sidebar.webp "Each widget is a titled section, so a reader can skip between them as landmarks.")

Each widget is a section labelled by its own heading, under a short brick-red rule, so the sidebar reads as a list of landmarks rather than a wall. From 60rem the sidebar sits beside the content behind a hairline; below it, the sidebar stacks under the content, where a phone reader finds it after the posts instead of before them.

![The Saltbox home on a phone](/showcase/saltbox/phone.webp "On a phone the nav folds into a menu and the sidebar moves under the posts.")

## A post page with everything around it

A post opens with a [Breadcrumbs](/api/ui/breadcrumbs) trail from Home through its kind to itself, then its kind, title and meta line, with the reading time for an article. What comes before the body depends on the kind: an article gets a standfirst, a link gets a card naming its destination with a button out, and a term gets its definition set large.

A tutorial in a series shows where it sits before anything else: "This post is part 2 of 3 in Self-hosting a Go service", every part listed in order with the current one in bold, and a link to the next part. Each part's title drops the series name it opens with, since the box already names it.

![A tutorial's series box](/showcase/saltbox/series.webp "The series box lists every part and links on to the next, before the body starts.")

A long article puts its outline in the sidebar as a [TableOfContents](/api/ui/table-of-contents) that sticks while the reader scrolls and marks the section in view. On a phone, where the sidebar sits under the post, the same outline becomes a bar above the body.

Under the body comes the entry footer, with the tags and a permalink, then the author box, then [DocsPager](/api/ui/docs-pager) labelled "Previous post" and "Next post", then up to three related posts chosen by shared tags. Where a classic theme put a comment form, Saltbox says "Comments are closed" and offers a reply by email with the post's title already in the subject line, since a demo with no backend has nowhere to keep a comment.

![The foot of an article](/showcase/saltbox/author-box.webp "Tags, the author box, the neighbouring post, related posts, and a reply by email in place of a comment form.")

## Archives, topics, search and a helpful 404

The archives page groups every post by year, then by month, each row a date, a title and the post's kind, with the same type filter as the home. Each month's heading carries its `YYYY-MM` id, which is what the sidebar's Archives widget links to.

![The archives page](/showcase/saltbox/archive.webp "Every post by year and month, narrowed by kind, each month an anchor the sidebar links to.")

The topics page draws the tag cloud large, then lists each tag with how many posts carry it and a sentence on what it collects. A tag's page is the loop again, under a header naming the tag. Search runs the shared `searchPosts` over titles, leads, tags and text; its type filter counts every match before narrowing, and a search with no results offers the topics instead.

The not-found page is the classic "That page can't be found", but useful: it prints the address that missed, fills the search box from its last segment, so `articles/pooling-in-go` arrives with "pooling in go" already typed, and lists the five newest posts to start from.

![A 404 page for a mistyped article address](/showcase/saltbox/not-found.webp "A missed address becomes a search, filled in from the path, with recent posts beside it.")

## Takes after

- [WordPress default themes](https://wordpress.org/themes/) — the masthead over a nav bar, the excerpt loop and the widget sidebar of the 2010s defaults; Saltbox keeps the pattern and draws the header band in CSS.
- [Hugo Stack](https://github.com/CaiJimmy/hugo-theme-stack) — archives with counts and a tag cloud as sidebar widgets; Saltbox links each month straight to its heading in the archive.
- [Simon Willison's weblog](https://simonwillison.net) — one stream where a link looks like a link and a note reads in full; Saltbox gives each kind its own body inside the same classic post frame.

## Where to start reading

- [`resources/views/demo-blogs/saltbox/frame.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-blogs/saltbox/frame.tsx) — the masthead, the CSS header band, the nav bar, the two columns and the footer.
- [`resources/views/demo-blogs/saltbox/parts.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-blogs/saltbox/parts.tsx) — a post as the loop draws it, shaped per kind.
- [`resources/views/demo-blogs/saltbox/widgets.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-blogs/saltbox/widgets.tsx) — the sidebar widgets.
