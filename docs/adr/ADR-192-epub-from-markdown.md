# ADR-192: EPUB Books From Markdown

## Status

**Implemented** - 2026-11-08

## Background

`@sdxc/epub` builds a publication from XHTML chapters, and its README showed how to render each
chapter with `@sdxc/markdown`. Everyone who wanted a book from Markdown rewrote the same steps:
split the text into chapters, render them, find the images, fix their paths for the
`text/<id>.xhtml` layout, and fill in the metadata. There was no way to make a book without
writing code.

ADR-187 says when a package gets a command line, and its first rule is that the library already
does the work. So turning Markdown into a book had to become library code before `sdxc-epub`
could exist.

## Decision

### `fromMarkdown` in `@sdxc/epub/markdown`

```ts
let book = await fromMarkdown({ source: { files }, read, remote, metadata, fonts, onProgress });
let built = EPUB.build(book.data.input);
```

- **One call, reads through `read`.** The library decides what it needs (chapter files,
  `styles.css`, then whatever those reference) and asks `read` for each file once. It does no
  I/O itself, so the same book builds from a disk, R2 or memory. An earlier design had two calls:
  list the assets, then pass their bytes in. That was dropped because the caller can't know what
  to read until the library has parsed the Markdown.
- **Two read phases with known totals.** Markdown files and `styles.css` are read first. Every
  image, cover and stylesheet `url()` is collected next, and `onProgress` announces the full
  local and remote lists before any of them is read. So a progress bar always has a total.
- **Errors reuse the `EpubError` codes**, plus a new `invalid-font`, so `fromMarkdown` and
  `EPUB.build` fail the same way.

### Structure conventions

| Markdown                        | Becomes                                                          |
| ------------------------------- | ---------------------------------------------------------------- |
| `# Title`                       | The book's title, on its own centered title page                 |
| Text between the title and `##` | An opening page (dedication, epigraph), left out of the contents |
| `## Heading`                    | A chapter                                                        |
| `###` and deeper                | Contents entries, down to `tocDepth` (default 3)                 |

- A file with no `##` heading becomes a single chapter named after the book.
- A folder reads `index.md` (frontmatter, title, opening page), then `ch<N>.md` or
  `ch<N>-<slug>.md` files sorted by their number as an integer, so `ch10` follows `ch9`, and
  finally `styles.css`.
- Other Markdown files are reported as ignored. Any other file in the folder is included only if
  something references it.
- These fail, naming the file: an `#` in a chapter file, a second `#`, text before a chapter
  file's first `##`, and two files with the same chapter number.
- Heading ids are unique across the whole book, so `#fragment` and `ch2.md` links are rewritten
  to the page that holds them. Footnote names are scoped per file, and each definition goes with
  the chapter that cites it.

### Paths

Files keep their folder layout inside the container, with each path segment cut down to the
characters EPUB allows. A path above the book's folder (`../`) becomes `_parent/`. Downloads are
stored as `remote/<digest>.<ext>`, and generated files live under `_book/`. Paths are unique
ignoring case.

### Fonts

`--font` files are read with `@sdxc/font`, which gives each one's family, weight and italic style
for the generated `@font-face` rules. A font whose license forbids embedding is refused. The
first font's family becomes the body face in the reading stylesheet. Whenever a book holds a
font, `EPUB.build` writes `ibooks:specified-fonts`, because without it Apple Books ignores
embedded fonts.

### `sdxc-epub`

- `build <file|folder|->` and `check`. Exit codes are 0 for done, 1 when `check` finds a problem,
  and 2 for usage errors, unreadable input or a book `build` cannot write.
- Progress goes to stderr through `ctx.task`: one line per read step, each counting reads
  against its total. Downloads get their own `downloaded/total` line.
- `--json` prints its report on stdout.
- `--allow-remote` downloads with a 30-second deadline and a 20 MB cap per file, at the user's
  risk.
- `SOURCE_DATE_EPOCH` fixes the modified date, so two builds of one source are byte for byte
  equal.
- The identifier defaults to a UUID derived from the title and authors, so a rebuild stays the
  same book in a reader's library.

## Consequences

### Positive

- A book is a folder of Markdown files; no code is needed to publish one.
- The library and the command line behave identically, since the command line only reads files.

### Negative

- `@sdxc/epub` now depends on `@sdxc/markdown`, `@sdxc/font`, `@sdxc/cli` and `remix`. These only
  load through the `./markdown` entry and the command line.
- Fonts ship whole. `@sdxc/font/subset` writes fonts without a character map, which CSS cannot
  use.

## Alternatives Considered

### 1. `--split <level>` to pick the chapter heading

**Rejected because**: a fixed rule (`#` is the title, `##` is a chapter) means every book reads
the same way, and a single file still gets a title page.

### 2. Fonts subset to the book's characters (`--subset-fonts`)

**Deferred because**: the subsets have no `cmap` table, so a reading system cannot map text to
glyphs. This can be added once `@sdxc/font` writes a subset that keeps the character map.

## Current Progress

- [x] `fromMarkdown` in `@sdxc/epub/markdown`
- [x] `ibooks:specified-fonts` for books with fonts
- [x] `sdxc-epub build` and `check`, with progress on stderr
- [ ] Font subsetting, waiting on a character-mapped subset in `@sdxc/font`
- [ ] epubcheck run over a book from `fromMarkdown` (needs Java or Docker)

## References

- [ADR-187: Package Command Lines](./ADR-187-package-command-lines.md)
- [ADR-145: `@sdxc/cli` Package](./ADR-145-cli-package.md)
