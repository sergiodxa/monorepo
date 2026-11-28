---
title: Plinth
headline: A personal blog set as an editorial index, where every kind of post shares one table-like row and a featured story leads in a signal block
summary: An invented design-systems engineer's blog about CSS and type, set as an editorial index of ink-black rows, type codes and one vermilion block.
tagline: An editorial index for a CSS blog
cover: home
shots:
  - id: home
    page: ""
    alt: The Plinth home, a display headline over a vermilion block holding the featured article, then a type filter, the 2026 index rows and a side rail of highlights, a series and topics.
  - id: featured
    page: ""
    highlight: "[data-slot=plinth-featured]"
    alt: The featured article in a vermilion block, its title in heavy black grotesk beside its lead, reading time, topics and a black Read the article button.
  - id: index
    page: ""
    highlight: "[data-slot=plinth-year]"
    alt: The 2026 index, one row per post with its date, a type code in a fixed column (NOTE, TERM, ART, LINK, TUT), its title and a meta column of minutes, hosts and series parts.
  - id: note
    page: "?type=notes"
    click: "[data-kind=notes] summary"
    highlight: "[data-kind=notes]"
    alt: A note row opened in place under its title, the note's paragraph indented to the title column with a permalink below it.
  - id: series
    page: "tutorials/token-pipeline-css"
    highlight: "[data-slot=plinth-series-box]"
    alt: A ruled series box reading Series, part 2 of 3, Build a token pipeline, with its three parts numbered, the current one in bold, and a link to part 3.
  - id: archive
    page: "archive"
    highlight: "[data-slot=plinth-masthead]"
    alt: The archive masthead, Everything at display size over a count of entries and a bar chart of entries per year in vermilion.
  - id: term
    page: "glossary/x-height"
    highlight: "[data-slot=plinth-post-header]"
    alt: The glossary entry for x-height, its term as the headline and its one-sentence definition set large in a vermilion block.
  - id: phone
    page: ""
    viewport: phone
    alt: The Plinth home on a phone, the headline and featured block stacked above the type filter and two-line index rows.
---

Plinth is an invented personal blog by Teodora Vass, a design-systems engineer in Rotterdam who writes about CSS, typography and design tokens. Neither she nor the blog exists. The demo is a complete public blog built from [@sdxc/ui](/api/ui) and [@sdxc/u](/api/u): one mixed feed of articles, tutorials, notes, links and glossary terms, a year-grouped archive, topics, search, an about page, a newsletter sign-up, an RSS feed and a 404, all drawn as an editorial index in ink black, one signal vermilion and a heavy grotesk.

It is the demo to read for a blog that has to hold a lot of different, mostly short things without turning into a wall of cards. Every post, whatever its kind, is listed as the same row: a date, a short type code in a fixed column, a title and a meta column. The kinds differ in weight and in what that meta column says, not in silhouette, so a page of thirty entries still scans like a table of contents.

## The brief

A developer's blog rarely publishes one kind of thing. There are long arguments, step-by-step tutorials, a paragraph about a CSS property noticed on a Tuesday, a link worth keeping and a definition the rest of the site leans on. Splitting those into sections hides the short ones; putting them all in one card grid makes a three-sentence note look like an empty article.

The constraint for this demo was one feed at the blog's root with every kind mixed in date order, a `?type=` filter on that same feed, and no separate index per kind. The direction was editorial and typographic: a large featured article on the first page, a compact table-like list below it, side modules for highlights, series and topics, and a year-grouped archive acting as the page that holds everything. The look had to be confident rather than quiet, and it had to stay readable and accessible in dark mode.

## A featured story in a signal block

The first unfiltered page opens with one line at display size, "CSS, type and the systems that hold them up", set in a heavy neo-grotesk with its last words in vermilion, and the author's two-sentence bio below it. Then comes the featured article as a block of colour: the title at up to 80px in black, its lead, its reading time and topics in monospace capitals, and a black button.

![The featured article in a vermilion block, its title in heavy black grotesk beside its lead, reading time, topics and a black Read the article button](/showcase/plinth/featured.webp "The featured block keeps ink-black type on vermilion in both schemes, so it reads the same in light and dark.")

The block deliberately ignores the colour scheme. Its background is the brand scale's 400 step and its text is the neutral scale's 950 step, both read straight from the palette rather than through the semantic tokens that flip in dark mode. That pairing has a contrast ratio near 9:1 on a white page and on an ink-black one alike, so the most important thing on the home page never changes character when the reader's system goes dark. The controller picks the story with `findFeaturedPost`, the newest post marked `featured: true`, and passes it only on the first unfiltered page; any filter or second page gets a plain masthead naming what the list holds instead.

## One row for every kind

Below the featured block, the feed is a list ruled by year. Each year opens with a heavy three-pixel rule, the year in the display face and a count of its entries, which is what lets each row show only its day and month. Each row is a CSS grid with four named areas on a desktop, `date code title meta`, so dates, codes and titles align down the page like a table without being one.

![The 2026 index, one row per post with its date, a type code in a fixed column, its title and a meta column of minutes, hosts and series parts](/showcase/plinth/index.webp "Long reads carry a filled code and short kinds an outlined one, so weight separates them before the label is read.")

The type code is the main signal. Articles and tutorials get a filled ink box (`ART`, `TUT`); notes, links and terms get an outlined one (`NOTE`, `LINK`, `TERM`). Colour is never the only cue: the codes are text, and the filled-or-outlined weight doubles them for a reader scanning fast. The meta column carries whatever helps a reader choose: minutes for an article, "Part 2/3" in vermilion for a tutorial in a series, the destination host with an arrow for a link, and "Definition" for a glossary term, whose one-sentence definition also runs under its title.

On a phone the same row becomes two lines. The grid's areas switch to `"code title" "code info"`, and the date and meta, which are separate cells on a desktop, sit together under the title in a wrapper that turns into `display: contents` from 48rem, so neither cell is duplicated in the markup. Every responsive rule that changes a property the base rule also sets lives inside the same `raw()` block as a nested `@media` query, which keeps the narrow and wide values in one class and their order predictable.

## Notes that open in the index

A note has no reason to make the reader leave the list. Its row is a native `<details>`: the summary is the row itself, with the same date, code and title as every other kind and a chevron in the meta column, and opening it shows the note's paragraphs indented to the title column, with a permalink underneath.

![A note row opened in place under its title, the note's paragraph indented to the title column with a permalink below it](/showcase/plinth/note.webp "A note opens under its own row with no script, and the chevron turns from the details element's open attribute.")

The note bodies are already prepared by the shared service, which renders a kind with the `note` layout to a document at list time, so the open row uses the same `PostBody` the post's own page uses. The chevron turns with `when("&[open] [data-chevron]", …)` on the details element, and the row tints while open. Keyboard users get the disclosure's built-in behaviour: Tab reaches the summary and Enter or Space toggles it.

## Series, highlights and topics beside the list

From 64rem the index has a side rail. Highlights lists the other featured posts with their codes. Series draws each series as an outlined box with its name, its length and its parts numbered `01` to `03`. Topics lists every tag as a chip with its count, most used first, from `countTags`. Below 64rem the rail follows the list, so a phone reader meets the curated ways in after the chronology rather than before it.

On a tutorial's own page the series moves to the top of the article. The box names the reader's position, "Part 2 of 3", lists every part with the current one in bold and unlinked, and ends on a link to the next part, the one a reader most likely wants.

![A ruled series box reading Series, part 2 of 3, Build a token pipeline, with its three parts numbered, the current one in bold, and a link to part 3](/showcase/plinth/series.webp "Next-in-series comes before the generic older and newer links at the end of the post.")

Articles and tutorials with two or more headings get an outline: `TableOfContents` as a rail in the right column from 64rem, held sticky beside the prose, and folded into its sticky `bar` layout above the body on smaller screens. Every post ends on its topics, the author with a short bio, one quiet newsletter block, `DocsPager` with the older and newer posts, and "Read next", the related posts drawn as the same index rows.

## An archive that holds everything

The archive is the "everything" page. Its masthead reads "Everything" at display size, counts the entries since the first year, and draws a small bar chart of entries per year: a `<dl>` where each bar's width is that year's count over the busiest year's. The same type filter as the feed narrows it, linking to `archive?type=notes`, and the list below is the same year-ruled index, only never paged.

![The archive masthead, Everything at display size over a count of entries and a bar chart of entries per year in vermilion](/showcase/plinth/archive.webp "The chart is a definition list with sized bars, so a screen reader hears each year and its count.")

Topics is a ranked list in the same register, each topic's name set large beside what it covers and its count. Search is a GET form built from `SearchField`, so a results page is an address that can be shared, with the type filter counted over the matches rather than over the whole blog.

## A glossary that reads as a definition

A glossary entry's page leads with the term as its headline and its definition, the post's one-sentence description, set large in the same vermilion block as the featured article. The body explains the term in a paragraph or two and links to the posts that use it, and the rail lists the other terms.

![The glossary entry for x-height, its term as the headline and its one-sentence definition set large in a vermilion block](/showcase/plinth/term.webp "The definition is the description every listing already shows, so a term reads the same in the index and on its page.")

On a phone the home keeps its order: headline, featured block, the type filter wrapping onto two lines rather than scrolling sideways, then two-line rows.

![The Plinth home on a phone, the headline and featured block stacked above the type filter and two-line index rows](/showcase/plinth/phone.webp "On a phone each row keeps its type code in a column of its own, with the date and meta under the title.")

## Takes after

- [Piccalilli](https://piccalil.li/blog) — bold art direction with big type and strong colour blocks; Plinth keeps one block for the story that matters most.
- [Jim Nielsen's blog](https://blog.jim-nielsen.com) — curated home sections beside a plain chronological archive by year.
- [Robin Rendle](https://robinrendle.com) — long typographic lists as the index of a personal site, applied here to a feed that mixes five kinds.
- [Ghost's Headline theme](https://ghost.org/themes/headline/) — a newspaper-like front page with a lead story and compact lists, reduced to one lead and one list.
