---
title: Understory
headline: A personal blog grown as a garden, where curated ways in sit above one mixed feed of cards sized by what each post weighs
summary: An invented developer's blog about local-first software and sync, with five kinds of post as tinted cards, backlinks and tended dates, built on @sdxc/ui.
tagline: A blog that grows like a garden
accent: "oklch(0.505 0.088 135)"
cover: home
shots:
  - id: home
    page: ""
    alt: The Understory front page on warm paper, a serif greeting about local-first software over a Start here strip with a large essay card and two smaller picks.
  - id: start-here
    page: ""
    highlight: "[data-slot=understory-start-here]"
    alt: The Start here strip, the featured essay with its moss canopy band and a Tended badge beside a smaller essay card and a plum glossary card for CRDT.
  - id: garden
    page: ""
    highlight: "[data-slot=understory-garden]"
    alt: The garden grid, a two-column essay card beside an ochre note shown in full and a small plum term card, then slate tutorial cards below.
  - id: filtered
    page: "?type=notes"
    highlight: "[data-slot=understory-filters]"
    alt: The filter bar with Notes selected in moss green, chips for every kind with its count and a coloured dot, and a row of topic links with counts.
  - id: rail
    page: "articles/the-server-is-a-peer"
    highlight: "[data-slot=understory-rail-terms]"
    alt: The rail beside an essay listing the glossary terms it uses, each in small capitals with its one-sentence definition.
  - id: backlinks
    page: "glossary/crdt"
    highlight: "[data-slot=understory-backlinks]"
    alt: The Linked from section on the CRDT glossary page, three cards for the essays and tutorial whose text links to the term.
  - id: series
    page: "tutorials/sync-from-scratch-hybrid-clocks"
    highlight: "[data-slot=understory-series-box]"
    alt: The series box on part two of Sync from scratch, open, listing the three parts with the current one marked you are here.
  - id: topics
    page: "tags"
    highlight: "[data-slot=understory-topics]"
    alt: The topic index as hub cards, each topic with its post count, a one-line description and its three newest posts marked by kind.
  - id: phone
    page: ""
    viewport: phone
    alt: The Understory front page on a phone, the greeting and author line above the Start here strip in one column.
---

Understory is an invented personal blog by Wren Halloran, a software developer in Bristol who builds sync engines, about local-first software, sync and tools for thought. The blog does not exist and neither does Wren. It is a blog demo built from [@sdxc/ui](/api/ui), its landing and docs kits, and [@sdxc/u](/api/u), drawn as a garden: warm paper, moss greens, a humanist book serif, and soft rounded cards whose size follows what each post weighs.

It is the demo to read for a blog that wants to be a resource rather than a stream. The front page still lists every post in one feed in date order, but it opens with curated ways in, gives every kind of post its own card shape and muted hue, marks posts that were updated since they went out, and ends every post with the posts that link to it.

## The brief

A developer's blog that runs for years collects five kinds of writing: long essays, step-by-step tutorials (some in series), short notes, links with a comment, and glossary terms. Most themes handle this by splitting them into sections, and the notes and terms quietly disappear from view. The rule for these demos is the opposite: the blog's root is one mixed feed of every kind in date order, `?type=` narrows that same feed, and there are no separate index pages per kind.

Understory takes that rule in the direction of a digital garden. A garden is evergreen-first: an essay that was rewritten last month matters more than the date it was first published, a glossary term is something to come back to, and a visitor arriving for the first time needs somewhere to start. The design question was how to keep one honest chronological feed while letting the evergreen material lead.

## Ways in before the stream

On the first page of the unfiltered feed, the page opens with a greeting in the reading serif and the author's line beside a portrait. Under it, a Start here strip puts the featured essay large on the left, with two hand-picked evergreen posts stacked beside it: a second essay and the glossary entry for CRDT, the term the rest of the blog leans on.

![The Start here strip, the featured essay with its moss canopy band and a Tended badge beside a smaller essay card and a plum glossary card for CRDT](/showcase/understory/start-here.webp "The featured essay leads, with two evergreen picks beside it for a first visit.")

The featured post is the controller's choice, the newest post marked `featured`, and the two picks are a short list of paths in the blog's own folder, so curating the strip is editing two strings. A Series strip follows, built from the posts themselves: every distinct `series` value becomes one card with its total reading time, a line on what it builds, and its parts in reading order, each with its own lead. Neither strip appears once a reader filters or pages on, so the curation never gets in the way of someone who came for the stream.

## Cards sized by weight

Then comes the feed itself, titled "Everything in the garden", as a grid of cards. Their shape follows the post's layout rather than a single card template. An essay or tutorial takes two columns on a wide screen and carries a canopy band, its title, its lead and its reading time. A note is printed in full, set in the reading face at a smaller size, because a note is meant to be read where it is listed. A link names its destination's host and the comment on why it was kept. A glossary term is a small card with the word in small capitals and its one-sentence definition.

![The garden grid, a two-column essay card beside an ochre note shown in full and a small plum term card, then slate tutorial cards below](/showcase/understory/garden.webp "Essays and tutorials take two columns, notes print in full, and terms stay small.")

Each kind owns one muted hue: moss for essays, slate for tutorials, ochre for notes, terracotta for links and plum for terms. The hue is never the only signal. Every card starts with a [LabelChip](/api/ui/label-chip) naming its kind, which derives its tint and text at fixed lightness so it clears contrast in both schemes, and each kind has its own silhouette. The card tint itself is written with `light-dark()` at fixed OKLCH lightness, so a card is near-white paper in light mode and a deep shade in dark mode whatever its hue.

The canopy band on a large card is decoration with a little craft: four radial gradients in the kind's hue, placed from a number derived from the slug. Each essay keeps the same leaves on every request, and no image files are involved. The grid packs densely so a small card fills the hole a two-column card leaves, while the markup keeps strict date order for anyone reading it without the layout.

Posts updated after publishing carry a Tended badge with a sprout and the update date, read from the `updated` front matter field. It is the garden's freshness signal, and the same badge appears on a post's own page beside its "Planted" date.

## A filter that is an address

Above the grid sits the filter bar. Its first row is a chip per kind with the number of posts of that kind and a dot in the kind's hue, plus Everything; each chip is a plain link to the feed with `?type=` set, and the current one is filled in moss. Its second row lists every topic with its count, and each topic links to that topic's own page, because a topic cuts across every kind of post.

![The filter bar with Notes selected in moss green, chips for every kind with its count and a coloured dot, and a row of topic links with counts](/showcase/understory/filtered.webp "Choosing a kind is following a link, so a filtered view can be shared or bookmarked.")

Because every choice is a link, there is no client state to restore, the back button behaves, and a filtered feed is an address someone can paste into a chat. The counts come from the blog's shared `countKinds` and `countTags` helpers, so the filter never offers a kind with nothing in it. Pagination reads the same way: Newer and Older pills around "Page 1 of 2", each linking to the next page of the same filtered feed.

## A post that knows its neighbours

A post's page sets the prose at a 42rem measure in Palatino, with the title block shaped by the kind: an italic lead for an essay, a definition card for a glossary term, a Visit button naming the host for a link. On wide screens a sticky rail holds the outline as a [TableOfContents](/api/ui/table-of-contents) and, below it, every glossary term the post uses, each with its definition.

![The rail beside an essay listing the glossary terms it uses, each in small capitals with its one-sentence definition](/showcase/understory/rail.webp "The rail lists the vocabulary the essay leans on, so a reader can check a term without leaving the page.")

The terms are not tagged by hand. A small module in the blog's folder reads each post's raw Markdown and collects the links that point at other posts under the blog's own address. A post's terms are the glossary entries among its outbound links, and its backlinks are the posts whose outbound links include it. That is the whole graph, worked out per request from the same files the posts render from, so writing a link in a post is all it takes for both ends to show it.

![The Linked from section on the CRDT glossary page, three cards for the essays and tutorial whose text links to the term](/showcase/understory/backlinks.webp "Every post ends with the posts that link to it, which is what turns a glossary into a hub.")

Every post ends in its connections: the terms it uses, as cards on screens too narrow for the rail, "Linked from", and "Growing nearby", the related posts by shared topics with anything already shown left out. A short author note carries the only subscribe invitation on the page, and a [DocsPager](/api/ui/docs-pager) links the older and newer posts by date. A term's page adds the whole glossary from A to Z as chips, the current term outlined.

## Series and topics

A tutorial in a series opens with a series box: a native `<details>`, open by default, summarising "Part 2 of 3 in Sync from scratch" and listing every part with the current one marked. The next part also appears at the end of the post as a prominent card, ahead of the chronological neighbours, so the series reads straight through.

![The series box on part two of Sync from scratch, open, listing the three parts with the current one marked you are here](/showcase/understory/series.webp "The series box sits under the title, and the next part waits at the end of the post.")

The topic index treats each topic as a hub card: its name, its post count, the sentence the blog's `tags` record gives it, and its three newest posts, each with a dot in its kind's hue. A topic's own page is a garden of its own, every post as a card with the kinds it holds counted in a line under the title.

![The topic index as hub cards, each topic with its post count, a one-line description and its three newest posts marked by kind](/showcase/understory/topics.webp "Topics cross every kind, so each hub mixes essays, notes, links and terms.")

The archive lists every post on one page, grouped by year, one ruled row per post with its day, its kind chip, its title in the serif and a Tended badge where one applies, with the same type chips as the feed. Search is a GET form whose results are cards, with chips counted over every match so a reader can see how many tutorials matched before choosing them. The not-found page offers the search box and three evergreen posts to start from.

On a phone the grid becomes one column, the header keeps the wordmark, search, Subscribe and the menu, and every card keeps its shape and label.

![The Understory front page on a phone, the greeting and author line above the Start here strip in one column](/showcase/understory/phone.webp "On a phone the strips and the grid stack into one column, each card still labelled by kind.")

## Takes after

- [Maggie Appleton's digital garden](https://maggieappleton.com/garden) — a filterable feed of cards labelled by type, with notes kept beside essays and tended dates on each; Understory keeps the labels and adds a hue and a silhouette per kind.
- [Gwern.net](https://gwern.net) — long-lived essays with metadata about their status and links that preview in place; Understory's rail of terms and its backlinks come from the same wish to keep a reader on the page.
- [Julia Evans](https://jvns.ca) — a home that offers favourites and categories before the full list; Understory's Start here and Series strips play that part above the stream.
- [Chirpy](https://chirpy.cotes.page) — a blog theme with docs-like tooling for tutorials, from outlines to last-modified dates; Understory brings the outline rail and the updated badge to a mixed-kind blog.
