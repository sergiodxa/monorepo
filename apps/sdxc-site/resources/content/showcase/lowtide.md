---
title: Low Tide
headline: A personal blog laid out as a logbook, where articles, notes, links and glossary entries share one stream and each keeps its own shape
summary: An invented engineer's blog about HTTP and caching, with five kinds of post in one dense, month-ruled stream, built on @sdxc/ui.
tagline: A blog that reads like a logbook
accent: "oklch(0.51 0.09 195)"
cover: feed
shots:
  - id: feed
    page: ""
    alt: The Low Tide front page, a short author line over a row of type filters, a featured article in a teal box, and the first month of the log beneath.
  - id: rows
    page: ""
    highlight: "[data-slot=stream] section"
    alt: One month of the log, with a note shown in full, a glossary term as a small card, a link with its host chip and an article with its lead, each labelled in the margin.
  - id: article
    page: "articles/cache-keys-are-a-contract"
    alt: The article Cache keys are a contract, its serif title and lead over a byline, the prose set in Charter beside an On this page rail.
  - id: outline
    page: "articles/cache-keys-are-a-contract"
    highlight: "[data-slot=post-rail]"
    alt: The On this page rail beside the article, listing its sections and subsections.
  - id: series
    page: "tutorials/edge-caching-revalidation"
    highlight: "[data-slot=series-box]"
    alt: The series box on part two of Edge caching from scratch, listing the three parts with the current one marked.
  - id: archive
    page: "archive"
    highlight: "[data-slot=archive-list]"
    alt: The archive's 2026 list, one line per post with its day, its kind in small capitals and its title.
  - id: not-found
    page: "articles/cache-key"
    alt: The 404 page for a mistyped address, with the path, a search box filled with cache key, and the glossary entry it probably meant.
  - id: phone
    page: ""
    viewport: phone
    alt: The Low Tide front page on a phone, the type filters scrolling sideways above the featured article.
---

Low Tide is an invented personal blog: Maren Okafor, a platform engineer in Lisbon, writing about HTTP, caching and the edge. Neither she nor the blog exists. The demo is the reader-facing side of a blog that publishes a lot of different things, built from [@sdxc/ui](/api/ui) with [@sdxc/u](/api/u), [@sdxc/markdown](/api/markdown) and [@sdxc/rss](/api/rss), and it answers one question: how does a blog with long articles, tutorials in series, short notes, saved links and a glossary stay readable when all of it lands in one feed?

Its answer is the logbook. The front page is a single column, ruled into months, in which every post keeps its kind in a narrow margin column and takes the shape that kind needs. An article is a title and a lead. A note is printed in full, because it is short enough to read where it is. A link goes straight to the page it saves, with the host beside it. A glossary term is a small definition card. The reader scans one stream and still knows at a glance what each line is.

## The brief

A personal blog that has been running for a few years collects more than articles. It gathers notes written in five minutes, links saved with a sentence of why, tutorials that come in parts, and the definitions an author keeps having to repeat. Most blog themes are built for one of those: a grid of article cards with cover images, or a minimal list of titles. Put everything in either and the short things vanish between the long ones, or the long ones lose the lead that makes a reader click.

The demo's constraints were taken from that problem. The root of the blog is one mixed feed in date order, never a page per kind, because a reader arriving at a blog wants to see what is new, whatever it is. Kinds narrow the same feed through `?type=`, so "show me only the notes" is a filter rather than a separate section with its own navigation. The archive has to fit years of posts in a few screens, and search has to find a note as easily as an article.

Every page is drawn from Markdown files with front matter: a title, a lead, a kind, a date, tags, and for some posts a series and its part or the address a link points to. Eighteen posts across five kinds give every row shape something to draw.

## One stream, five row shapes

The front page opens with one line about who writes the blog and how much is in it, counted from the posts rather than written down. Under it sits the type filter, a row of links with a count beside each kind, which scrolls sideways on a phone so it never pushes the stream down. The first unfiltered page pins the featured article above the log in a tinted box with its lead and reading time.

![One month of the log, with a note shown in full, a glossary term as a small card, a link with its host chip and an article with its lead, each labelled in the margin](/showcase/lowtide/rows.webp "Each kind keeps its label in the margin and takes its own shape in the column.")

The stream itself is grouped by month under sticky headings, so a reader scrolling back always knows when they are. Each row is a two-column grid from 52rem: the kind in small monospace capitals on the left, the post on the right. Below that width the label moves above the title and the row becomes one column. The shape on the right is chosen by the kind's layout in the blog's record, `article`, `note`, `bookmark` or `term`, so a new kind of post is a line in the site's configuration rather than a new component. A note's body is rendered in the stream through the same Markdown pipeline as its own page, code spans included, at a smaller size than an article's prose so it reads as an aside.

Every row ends on the same meta line: the date, linking to the post's own page, then whatever the kind adds, such as reading time or "Part 2 of Edge caching from scratch", then the tags as `#tag` links. The feed pages back in time eight posts at a time with Newer and Older, and a page number past the end answers the blog's own 404.

## Reading an article

An article's page is the long-form layout: a breadcrumb back to its kind's feed, the kind label, a serif title, the lead, and a byline with the author's initials, the date and the reading time. The prose is set at 20px in Charter through the [Typeset](/api/ui/typeset) component's reading preset, with the code and asides of the Markdown drawn by the docs kit's [CodeBlock](/api/ui/code-block) and [Callout](/api/ui/callout), and every section heading an [AnchorHeading](/api/ui/anchor-heading) with a link a reader can share.

![The On this page rail beside the article, listing its sections and subsections](/showcase/lowtide/outline.webp "The outline sits in a rail on a wide screen and folds into a sticky bar on a narrow one.")

The outline is the docs kit's [TableOfContents](/api/ui/table-of-contents), used twice: as a rail in a third grid column from 72rem, and as a sticky bar above the prose below that, which names the section being read. Both read the headings the Markdown pipeline anchored, so the outline and the page can never disagree. The article closes on what to do next: the tags it is filed under, an author card with the newsletter form, the older and newer posts through [DocsPager](/api/ui/docs-pager), and up to three related posts, chosen by shared tags and drawn in the stream's own rows.

## Series, links and terms

A post in a series carries a box above its body listing every part in order, with the current one marked and the others linked, so a reader who lands on part two from search can start at part one.

![The series box on part two of Edge caching from scratch, listing the three parts with the current one marked](/showcase/lowtide/series.webp "A series is two fields of front matter; the box is built from every post that shares them.")

The other kinds get pages sized to what they are. A note's page is its title, its body and its date, without a lead or an outline. A link's page puts a button to the original site and its host above the comment, since the comment is why the link was saved but the page is what the reader came for. A glossary term reads as an entry: the term as the title, the definition as the lead, a paragraph or two of explanation, and the posts that share its tags. Articles link to terms in their prose, so a reader meeting "cache key" for the first time is one click from what it means.

## An archive that fits

The archive lists every post grouped by year, one line each: the day in monospace, the kind in small capitals, the title in the serif. Years link from the top, and the same type filter as the feed narrows the archive to one kind. Eighteen posts fit on two screens; a few hundred would still fit on a handful.

![The archive's 2026 list, one line per post with its day, its kind in small capitals and its title](/showcase/lowtide/archive.webp "One dense line per post, so years of writing can be scanned rather than paged.")

Topics list every tag with what it covers and how many posts carry it, most written about first, and each tag's page is the same month-ruled stream filtered to it, with a count of each kind at the top. Search is a plain GET form, so a result page is an address a reader can share; its results are the stream's rows, narrowed by the same type filter, whose counts are taken from the matches.

## The small finish

The newsletter form posts rather than submitting a GET, so a reader's address never lands in a URL or a server log line, and the post answers with a redirect to a confirmation, so a reload never signs anyone up twice. The RSS feed at `rss.xml` is built by `@sdxc/rss` from the same posts the pages read, a link post pointing at the page it saves. A mistyped address answers 404 inside the blog's frame, shows the path it was asked for, fills the search box with the words in it and offers the posts those words match.

![The 404 page for a mistyped address, with the path, a search box filled with cache key, and the glossary entry it probably meant](/showcase/lowtide/not-found.webp "A wrong link to articles/cache-key offers the glossary entry it most likely meant.")

The whole blog is themed through the tokens on one wrapper: a sea-glass teal brand scale at hue 195, sand neutrals at hue 85, Charter for titles and prose, the system sans for navigation and meta, and small radii. Light and dark both come from the same scales. The header and footer are the landing kit's [SiteHeader](/api/ui/site-header) and [SiteFooter](/api/ui/site-footer); on a phone the header folds its links into a sheet and keeps search, the feed icon and the sign-up in the bar.

![The article Cache keys are a contract, its serif title and lead over a byline, the prose set in Charter beside an On this page rail](/showcase/lowtide/article.webp "Long-form reading at 20px in Charter, with the outline beside it.")

On a phone the front page keeps its order: author line, filters, featured article, then the log, with the margin labels moved above each title.

![The Low Tide front page on a phone, the type filters scrolling sideways above the featured article](/showcase/lowtide/phone.webp "On a phone the type filters scroll sideways and the margin labels move above each title.")

## Takes after

- [Simon Willison's Weblog](https://simonwillison.net) — entries, link posts, quotations and notes in one stream, each with its own shape; Low Tide adds the margin column so the kind is read before the title.
- [Manuel Moreale](https://manuelmoreale.com) — a quiet single column where short posts are read in place; Low Tide prints its notes in full in the feed for the same reason.
- [Rach Smith's digital garden](https://rachsmith.com) — notes, links and longer posts mixed with small type labels; Low Tide keeps the labels and rules the stream by month.
- [AstroPaper](https://astro-paper.pages.dev) — a fast, typographic blog theme with an archive by year and plain search; Low Tide's archive keeps that density for mixed kinds.
