# ADR-176: `@sdxc/pdf` Writes PDF Documents Through an Imperative API

## Status

**Proposed** - 2026-10-26

## Background

The blog's résumé offers a PDF download in each language. Today `sdxc run resume pdf` writes
a LaTeX source from the résumé's structured content, then runs Tectonic, an external LaTeX
engine, to typeset it into `public/resume/`. The LaTeX file is only a step in between: no one
edits it, and the structured content is the source. The step still needs a binary installed
on the machine that builds the PDFs, it can't run inside a Worker, and a machine without
Tectonic writes the sources but no PDFs.

We want PDFs drawn from structured content by a library that runs wherever the apps run,
Workers included. In the longer term we want to render a `remix/component` tree, styled with
`css()` and `@sdxc/u`, to PDF, the way react-pdf renders React. That needs a layout engine
and a component renderer, and both need something to draw onto. This ADR decides only that
first layer: an imperative API that writes the PDF.

## Context

### Current Pipeline

| Step                        | Where                                                 | Runs in a Worker |
| --------------------------- | ----------------------------------------------------- | ---------------- |
| Structured résumé content   | `apps/blog/resources/content/resume/*.ts`             | Yes              |
| Content to LaTeX source     | `resumeLatex()` in `apps/blog/app/services/resume.ts` | Yes              |
| LaTeX to PDF                | `tectonic --outdir public/resume …`                   | No               |
| PDF served as a static file | `public/resume/*.pdf`                                 | Yes              |

### What Already Exists

- **`@sdxc/font`** ([ADR-150](./ADR-150-font-package.md)) parses TrueType fonts and answers
  glyph lookup, advances, kerning and single-line layout. Measuring text, the hard half of
  setting it, is already done.
- **`@sdxc/png`** decodes PNG files to pixels over Web Streams, which an embedded image needs
  when it has an alpha channel.
- **`CompressionStream("deflate")`** exists in Workers, Bun, Node and browsers. It writes the
  zlib format, which is what a PDF's `FlateDecode` filter reads.

### What a PDF Writer Needs

| Concern         | Detail                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------ |
| File structure  | Numbered objects, a cross-reference table with byte offsets, a trailer                     |
| Content streams | Text, path and image operators, compressed with `FlateDecode`                              |
| Fonts           | An embedded TrueType font, glyph widths, and a `ToUnicode` map so text copies and searches |
| Images          | JPEG passed through as `DCTDecode`; PNG decoded to RGB plus a soft mask for alpha          |
| Links           | `Link` annotations over a rectangle, pointing at a URI                                     |
| Metadata        | Title, author, language and creation date                                                  |

## Decision

Create `@sdxc/pdf`, which writes PDF 1.7 documents through one configured `PDF` instance.
Callers place everything explicitly; the package measures and wraps text but decides no
layout of its own.

```ts
import { PDF } from "@sdxc/pdf";
import { isFailure } from "@sdxc/result";

let pdf = new PDF({ size: "letter", title: "Résumé", author: "Sergio Xalambrí", lang: "en" });

let regular = pdf.font(interRegularBytes); // Result<PDF.Font, PDFError>
if (isFailure(regular)) return regular;
let bold = pdf.font(interBoldBytes);
if (isFailure(bold)) return bold;

let page = pdf.page();
page.text("Sergio Xalambrí", { x: 40, y: 40, font: bold.data, size: 24 });
page.line({ from: [40, 76], to: [572, 76], width: 0.5, color: "#999999" });

let summary = pdf.paragraph(
	[
		{ text: "Full-stack web developer since 2013. I build the web app at " },
		{ text: "Daffy", href: "https://www.daffy.org", font: bold.data },
		{ text: " and maintain open-source libraries." },
	],
	{ width: 532, font: regular.data, size: 10, lineHeight: 1.4, color: "#222222" },
);
page.paragraph(summary, { x: 40, y: 88 }); // returns the y below it

return new Response(pdf.stream(), { headers: { "Content-Type": "application/pdf" } });
```

### Coordinates and Units

- Lengths are PDF points (1/72 inch). `size` takes `"letter"`, `"a4"` or `[width, height]`.
- The origin is the page's top-left corner and y grows downward, the way a web layout
  thinks. The package flips to PDF's bottom-left origin when it writes each operator.
- Colors are `#rrggbb` strings.

### The `PDF` Instance

| Member                         | Contract                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `new PDF(options)`             | Default page size, plus `title`, `author`, `lang` and an optional `createdAt`               |
| `pdf.font(bytes)`              | Parses with `@sdxc/font` and registers the font for embedding; `Result<PDF.Font, PDFError>` |
| `pdf.image(bytes)`             | Reads a JPEG or PNG; `Result<PDF.Image, PDFError>` with its pixel size                      |
| `pdf.paragraph(runs, options)` | Wraps runs to a width and returns a `PDF.Paragraph` that knows its lines and height         |
| `pdf.page(options?)`           | Appends a page, optionally with its own size, and returns it                                |
| `pdf.stream()`                 | The finished document as `ReadableStream<Uint8Array>`                                       |
| `pdf.bytes()`                  | The same document as `Promise<Uint8Array>`                                                  |

### The Page

| Method                                                   | Draws                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `text(text, { x, y, font, size, color?, align? })`       | One line, with `y` at the top of the line box; `align` measures from `x` |
| `paragraph(paragraph, { x, y })`                         | A wrapped paragraph; returns the y just below its last line              |
| `line({ from, to, width, color })`                       | A straight stroke                                                        |
| `rect({ x, y, width, height, fill?, stroke?, radius? })` | A rectangle, optionally rounded                                          |
| `image(image, { x, y, width, height? })`                 | An image, its height kept to the image's aspect when omitted             |
| `link({ x, y, width, height }, href)`                    | A clickable area over whatever is drawn there                            |

### Paragraphs and Page Breaks

A paragraph is laid out before it is placed, so a caller can fit it to the space left on a
page before deciding where it goes:

```ts
let rest = summary;
let y = 88;
while (rest) {
	let [fits, overflow] = rest.split(pageBottom - y); // whole lines only
	y = page.paragraph(fits, { x: 40, y });
	if (overflow) {
		page = pdf.page();
		y = 40;
	}
	rest = overflow;
}
```

- A paragraph is a list of runs. Each run sets its own `font`, `size`, `color` and `href`, and
  inherits the paragraph's defaults for any it leaves out. A run with `href` gets a link
  annotation over every line fragment it occupies.
- Lines break at spaces and after hyphens, using `Font.measure`, kerning included. A word
  wider than the line breaks between characters.
- `paragraph.height` and `paragraph.lines` are public, so a later layout engine can position
  paragraphs without drawing them first.
- The package never adds pages on its own. Page breaking is a layout decision, and it stays
  with the caller, or with the layout engine that comes later.

### Fonts

- A font embeds as a `Type0` font with a `CIDFontType2` descendant, `Identity-H` encoding and
  glyph ids as character ids. Text is written as glyph ids in `TJ` arrays, with each kerning
  pair as an adjustment, so the PDF shows the same spacing `Font.layout` measured.
- A `W` array carries the advance of each glyph used, and a `ToUnicode` CMap maps each glyph
  back to the code point it was drawn for, so copying and searching return the original text.
- The `FontDescriptor` is filled from the metrics `@sdxc/font` exposes for embedding
  ([ADR-177](./ADR-177-font-embedding-metrics-and-subsetting.md)): PostScript name, bounding
  box, italic angle, cap height and style flags. `StemV` is estimated from the weight class.
- A font whose license forbids embedding fails with a `PDFError`. A font whose license allows
  embedding but not subsetting embeds whole.
- The first version embeds the whole font file (`FontFile2`). Once `@sdxc/font` can subset,
  `@sdxc/pdf` embeds a subset of the glyphs each document uses, renumbered, and writes the
  subset's glyph ids in its text.
- Fonts are TrueType only, inheriting `@sdxc/font`'s limits: no CFF, no shaping, no
  bidirectional text.

### Output

- Classic cross-reference table and trailer; no object streams, so every part of the file
  can be read in a text editor.
- Output is deterministic: the same calls with the same `createdAt` write the same bytes, so
  a test can compare documents and an edge cache can key on content.
- Failures that come from input, such as an unreadable font or image, return a `Result`
  with a `PDFError` whose `code` names the problem. Drawing methods take only values the
  package created, so they have no failure path of their own.

## Consequences

### Positive

- **PDFs anywhere the apps run.** A Worker can answer `/resume.pdf` from the résumé's content,
  with no binary to install and no build step.
- **One source for text.** The PDF wraps and kerns with the same `@sdxc/font` metrics the
  social cards use.
- **A target for what comes next.** Runs, measured paragraphs and explicit page breaks are
  what a layout engine and a `remix/component` renderer need underneath them.
- **No LaTeX in the repository.** The résumé's `.tex` sources and their generator go away once
  the blog switches.

### Negative

- **Large files at first.** Embedding whole fonts adds hundreds of kilobytes per font until
  subsetting lands.
- **Latin-first.** No ligatures, no complex scripts, no right-to-left text.
- **No tagged PDF.** Screen readers get the text, through `ToUnicode`, but no structure. That
  means no headings, lists or reading order, so the documents aren't PDF/UA.
- **Manual layout.** Until a layout engine exists, every document places its own boxes and
  handles its own page breaks.

### Neutral

- PDF 1.7 is readable by every current viewer; the package uses no feature newer than it.
- Hyphenation is out of scope; lines break only where the text already allows it.

## Implementation Plan

### Phase 1: Document, Pages and Shapes

**Priority:** High
**Estimated Effort:** 1 day

1. Object model, cross-reference table, trailer and metadata
2. Pages with sizes, `line`, `rect` and `FlateDecode` content streams
3. `stream()` and `bytes()`, deterministic output

### Phase 2: Text

**Priority:** High, after ADR-177's metrics phase
**Estimated Effort:** 2 days

1. `pdf.font()` over `@sdxc/font`, `Type0` and `CIDFontType2` embedding, `W` array, `ToUnicode`
2. `page.text()` with kerning through `TJ`
3. `pdf.paragraph()` with runs, wrapping, `split()` and link annotations

### Phase 3: Images and Links

**Priority:** Medium
**Estimated Effort:** 1 day

1. JPEG through `DCTDecode`, PNG through `@sdxc/png` with a soft mask for alpha
2. `page.link()`

### Phase 4: The Résumé

**Priority:** Medium
**Estimated Effort:** 1 day

1. Render the résumé from its structured content with `@sdxc/pdf`, serving `/resume.pdf` per
   language from the Worker or writing the files from the command
2. Remove the LaTeX sources, `resumeLatex()` and the Tectonic step

### Phase 5: Font Subsetting

**Priority:** Low
**Estimated Effort:** half a day, after ADR-177's subsetting phase

1. Collect the glyphs each font draws, embed `font.subset()`'s bytes, and write the subset's
   glyph ids in the text, `W` array and `ToUnicode` map

## Alternatives Considered

### 1. Keep LaTeX and Tectonic

**Rejected because**: it needs an external binary on the machine that builds the PDFs, it
can't run in a Worker, and it keeps a generated LaTeX source as a second rendering of the
résumé's content.

### 2. `pdf-lib`

A pure-JavaScript PDF writer that runs in Workers.

**Rejected because**: it has had no release since 2021, and it needs fontkit to embed custom
fonts. That would mean a second font reader beside `@sdxc/font`, which already measures the
text, and the two could disagree about a metric. It also offers no text wrapping, so the
paragraph work would still be ours.

### 3. `pdfkit`

**Rejected because**: it is built on Node streams and the file system, so it needs polyfills to
run in a Worker, and it brings its own font stack.

### 4. Print the HTML Page with Cloudflare Browser Rendering

Render `/resume` in headless Chromium and print it with print CSS.

**Rejected because**: it needs a paid binding and a browser session per render. It is a
reasonable fallback, but it doesn't give the repository a PDF library.

### 5. Typst Compiled to WebAssembly

**Rejected because**: it adds a multi-megabyte WebAssembly module and a second markup language,
and keeps an intermediate document between the content and the PDF.

## References

- [PDF 1.7 (ISO 32000-1)](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf)
- [ADR-150: `@sdxc/font`](./ADR-150-font-package.md)
- [ADR-149: `@sdxc/png`](./ADR-149-png-package.md)
- [ADR-177: `@sdxc/font` embedding metrics and subsetting](./ADR-177-font-embedding-metrics-and-subsetting.md)

## Current Progress

- [ ] Phase 1: Document, pages and shapes
- [ ] Phase 2: Text
- [ ] Phase 3: Images and links
- [ ] Phase 4: The résumé
- [ ] Phase 5: Font subsetting

## Notes

- A layout engine (boxes, flex, page breaking) and a `remix/component` renderer that targets
  this API are separate decisions, each with its own ADR. The first question for the
  renderer is whether a server render exposes the rules `css()` generated, which its
  documentation doesn't say.
- The new package needs a `description`, a `LICENSE.md`, a row in the root README table,
  `bun run release:bootstrap @sdxc/pdf`, a trusted publisher on npmjs.com, and an entry in
  `apps/sdxc-site/resources/content/groups.ts`.
