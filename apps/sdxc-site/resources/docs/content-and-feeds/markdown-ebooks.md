---
title: Write a book in Markdown
description: Keep a book as a folder of Markdown chapters and build it into an EPUB from the terminal with sdxc pkg epub, with a title page, embedded fonts and images, checked in CI.
section:
    title: Content & feeds
    order: 8
order: 20.5
lastUpdated: 2026-11-09
outcomes:
    - "How to lay out a book as `index.md` and `ch<N>.md` files that `sdxc pkg epub` builds"
    - "How to add a cover, fonts, a stylesheet and images, including ones from the web"
    - "How to check the book in CI and build it the same way every time"
---

A book kept as Markdown files diffs, reviews and versions like code. `sdxc pkg epub` turns those
files into an EPUB that e-readers, phone reading apps and Send to Kindle open, without any code
of your own. It runs the command line [`@sdxc/epub`](/api/epub) ships, which refuses at build time
what epubcheck would reject.

Install `sdxc` once, as [The sdxc command](/docs/getting-started/the-sdxc-command) shows:

```bash
npm add -g @sdxc/kit
```

## Lay out the book

A book is a folder. `index.md` holds the details about the book and its title, and each chapter
file holds chapters:

```text
my-book/
├── index.md
├── ch1-arrival.md
├── ch2.md
├── ch10.md
├── styles.css
└── images/
    └── harbor.jpg
```

Chapter files are named `ch` followed by a number, with an optional `-slug`. They are read in
number order, so `ch10.md` comes after `ch9.md`, not after `ch1.md`.

`index.md` starts with frontmatter, then the `#` title. Any text after the title is placed on its
own page before the first chapter, which suits a dedication or an epigraph:

```text {% title="my-book/index.md" %}
---
author: Ana Pérez
language: en
description: Stories from a harbor town.
cover: images/harbor.jpg
---

# The Harbor

For my mother, who read to me.
```

The title gets a page to itself, set large and centered like a cover, with the authors below it.

Every `##` heading in a chapter file starts a chapter, and `###` headings become entries nested
under it in the table of contents:

```text {% title="my-book/ch1-arrival.md" %}
## Arrival

The ferry came in at dusk. ![The harbor at dusk](images/harbor.jpg)

### The Inn

She took the room above the bar.[^1]

[^1]: The inn closed in 1998.
```

A footnote is kept with the chapter that cites it. Links work across chapters too: `[back to the
inn](#the-inn)` and `[next](ch2.md)` point at the right page in the book.

## Build it

```bash
sdxc pkg epub build my-book/
```

Each step prints a line to stderr with its progress, and the book is written beside the folder as
`my-book.epub`:

```text
✓ Reading my-book 5/5
✓ Reading images, stylesheets and fonts 1/1
✓ Wrote my-book.epub: 5 pages, 412.3 KB
```

`-o dist/the-harbor.epub` writes it somewhere else. A short piece doesn't need a folder: pass a
single file, and its `##` headings become the chapters. A file with no `##` heading becomes one
chapter.

```bash
sdxc pkg epub build essay.md --author "Ana Pérez" --cover cover.jpg
```

Flags such as `--title`, `--author`, `--language` and `--cover` override the frontmatter.

## Add fonts and a stylesheet

`--font` embeds a font file. The first font sets the body text, and the rest of the same family
add its italic and bold:

```bash
sdxc pkg epub build my-book/ \
  --font fonts/Literata-Regular.woff2 \
  --font fonts/Literata-Italic.woff2 \
  --font fonts/Literata-Bold.woff2
```

The family, weight and style come from each font file, so you write no `@font-face` rules. A font
whose license forbids embedding is refused. The book also tells Apple Books to use the fonts,
which it otherwise ignores.

`styles.css` in the folder applies after the built-in reading stylesheet, so it only needs your
changes. A font it loads with `url()` is embedded too:

```css {% title="my-book/styles.css" %}
h2 {
	font-variant: small-caps;
}
```

`--style` adds a stylesheet from anywhere else, and `--no-default-style` leaves out the built-in
one, centered title page included.

## Use images from the web

An image that loads from a URL fails the build, since a book must carry its own files:

```text
https://example.com/map.png: remote-resource "ch3.md" loads "https://example.com/map.png" from the web; download it into the book or allow remote files
Pass --allow-remote to download it into the book, at your own risk.
```

`--allow-remote` downloads each image into the book, at most 20 MB and 30 seconds per file. It
fetches every URL the book names, so use it only on books whose links you trust. The downloads get
a progress line of their own:

```bash
sdxc pkg epub build my-book/ --allow-remote
```

```text
✓ Downloading remote files 7/7
```

## Check it in CI

`check` runs the whole build and writes nothing. It exits 1 and names the file to fix when the book
has a problem, such as a missing image, malformed markup, a broken link or a chapter file with text
before its first `##`:

```bash
sdxc pkg epub check my-book/
```

`--json` prints the result on stdout for a script, while progress stays on stderr:

```bash
sdxc pkg epub check my-book/ --json
```

Set `SOURCE_DATE_EPOCH` when you build a release, and two builds of the same files come out byte
for byte equal. The identifier e-readers recognize the book by is derived from its title and
authors, so a new build replaces the old one in a reader's library instead of appearing beside it:

```bash
SOURCE_DATE_EPOCH=$(git log -1 --format=%ct) sdxc pkg epub build my-book/ -o dist/the-harbor.epub
```

## Where to go next

- [Offer posts as EPUB ebooks](/docs/content-and-feeds/ebooks) builds books from inside an app,
  with `fromMarkdown` from `@sdxc/epub/markdown` reading the same layout.
- [Use a package from the terminal](/docs/operations-and-testing/package-command-lines) covers the
  conventions every package command line shares.
- [`@sdxc/epub`](/api/epub) lists every error code a build can fail with.
