# ADR-121: EPUB Package

## Status

**Accepted** - 2026-10-08

## Background

Two apps publish long-form writing that people read on a device other than the browser they found
it in. `books` is the sales funnel for a handbook: an address unlocks a sample chapter, which is
rendered from Markdown into the response to that `POST` and stored nowhere. The person who just
gave their address cannot take the chapter to an e-reader, which is where a handbook is read.
`blog` publishes tutorials that run to several thousand words, and an ebook of a tutorial is the
format readers ask for when they want to read it offline or annotate it.

EPUB 3 is the format every e-reader, phone reading app and Send to Kindle accepts. Building one is
a pure transformation with no I/O: XHTML content documents, a package document, a navigation
document, and a ZIP container with one unusual rule about its first entry. This ADR adds
`@sdxc/epub` to build publications, and `@sdxc/zip` to write the container, because a ZIP writer
has consumers of its own. The writer stores entries uncompressed for now; DEFLATE arrives when a
consumer's archives are large enough to need it.

## Context

### Consumers

| App      | What it would build                                      | Content today                                                                               |
| -------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `books`  | The sample chapter as `.epub`, beside the HTML rendering | `resources/content/sample.md`, parsed with `@sdxc/markdown`, painted with `@sdxc/highlight` |
| `blog`   | A tutorial, or a set of them, as an ebook                | Markdown bodies rendered through `@sdxc/markdown`; `/tutorials` lists them                  |
| `uptime` | A ZIP of several report CSVs in one download (zip only)  | `report-download.ts` streams one CSV per request                                            |
| `reader` | A data export: OPML, saved items, highlights (zip only)  | `feeds/export.tsx` answers OPML alone; the rest of a reader's data has no export            |

`books` has no bindings and no state, so it builds the file at request time from the Markdown it
already bundles, the way it renders the HTML chapter. Gating the download behind the same address
is the app's decision (a signed short-lived link, or a second form button on the unlocked page);
the package only produces bytes.

### What an EPUB 3 publication is

EPUB 3.3 (a W3C Recommendation since 2023) defines a publication as files in an OCF container:

| File                              | Role                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `mimetype`                        | The first entry, the bytes `application/epub+zip`, **stored uncompressed with no extra field**             |
| `META-INF/container.xml`          | Points at the package document                                                                             |
| Package document (`.opf`)         | Metadata, the manifest of every resource with its media type and properties, and the spine (reading order) |
| Navigation document (`nav.xhtml`) | An XHTML `<nav epub:type="toc">`, plus optional landmarks; it is itself a manifest item with `nav`         |
| Content documents (`.xhtml`)      | XHTML: the HTML vocabulary in XML syntax, well-formed, in the XHTML namespace                              |
| Resources                         | Images, stylesheets and fonts, each listed in the manifest; images may not be remote                       |
| `toc.ncx` (optional)              | The EPUB 2 table of contents, which older reading systems still read                                       |

The package document requires `dc:identifier` (referenced by `unique-identifier`), `dc:title`,
`dc:language` and `dcterms:modified` in `CCYY-MM-DDThh:mm:ssZ`. The identifier is what a reading
system uses to recognise a book in its library, so a new random identifier per download makes every
download a different book.

Manifest properties must match content: a document with inline SVG carries `svg`, one with MathML
`mathml`, one with script `scripted`, one referencing remote resources `remote-resources`. The
cover image carries `cover-image`. epubcheck reports a missing or extra property as an error.

### The ZIP container

ZIP is a sequence of local entries (header, data, optional data descriptor) followed by a central
directory. Each entry records a CRC-32 and both sizes. A writer that knows them before writing the
data puts them in the local header; one that streams sets general-purpose bit 3 and writes them in a
data descriptor after the data. Bit 3 on a **stored** entry leaves a streaming reader no way to find
the end of the data, so stored entries need their CRC and size up front.

Each entry is either stored (method 0, the bytes as they are) or compressed, almost always with
DEFLATE (method 8). OCF allows both for every EPUB entry except `mimetype`, which must be stored, and
every reading system opens an archive whose entries are all stored. A stored entry needs nothing but
its CRC-32, which has no Web API and is a 256-entry table and a loop.

DEFLATE is available in every target runtime as `CompressionStream("deflate-raw")`, and
`packages/saml/src/lib/deflate.ts` already relies on it. Text compresses three to four times; images,
fonts and the consumers' first archives are small or already compressed, so storing costs little today.

ZIP64 extends the format past 4 GiB per entry or 65,535 entries. No consumer here comes near either.

### What the format packages already give

| Package           | Relevant capability                                                                                                     | Gap for EPUB                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `@sdxc/markdown`  | `toHTML` writes `<hr />`, `<img … />`, `<br />`; text is escaped to `&amp;`, `&lt;`, `&gt;`; raw HTML renders escaped   | A task item's `<input … disabled checked>` is not XML: bare boolean attributes and an unclosed void. Annotation booleans are the same |
| `@sdxc/xml`       | Parses and serializes elements, attributes, namespace prefixes; `whitespace: "preserve"`; resolves XHTML named entities | Nothing: parsing then serializing turns `&nbsp;` into the character, which is exactly what EPUB's DTD-less XHTML requires             |
| `@sdxc/html`      | Parses served HTML and queries it by role and name                                                                      | Exposes queries, not a tree to re-serialize, so it cannot turn HTML5 into XHTML today                                                 |
| `remix/component` | Server JSX rendered to an HTML string                                                                                   | HTML5 serialization (`<br>`, bare booleans), which is not XML                                                                         |

### Issues identified

| Issue                                                        | Impact                                                                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| The sample chapter exists only as a page that cannot be kept | The funnel's one free artifact cannot reach the device the handbook is read on                            |
| No ZIP writer in the repo                                    | Every multi-file download (reports, data exports, ebooks) would write the container by hand               |
| XHTML is easy to get almost right                            | One `&nbsp;` or `<br>` in one chapter is a fatal epubcheck error and some reading systems refuse the file |
| Manifest properties depend on content                        | Hand-written properties drift from what the chapters contain                                              |

## Decision

Add two public packages:

- **`@sdxc/zip`**: a streaming ZIP writer, with CRC-32. Writing only, and storing only: every entry
  is written uncompressed (method 0) until a consumer needs DEFLATE.
- **`@sdxc/epub`**: builds an EPUB 3.3 publication from metadata, XHTML chapters and resources,
  verifies what epubcheck would reject, and writes it through `@sdxc/zip`.

And one change in an existing package:

- **`@sdxc/markdown/html`** gains `toHTML(node, { syntax: "xhtml" })`, which writes every void
  element self-closed and every boolean attribute as `name="name"`.

### `@sdxc/zip`

ZIP is a format capability with three consumers, so it is its own package, the way `@sdxc/csv` and
`@sdxc/opml` are. `@sdxc/epub` depends on it.

```typescript
import { Zip } from "@sdxc/zip";

let zip = new Zip();
zip.add("summary.csv", summaryCsv); // a string or Uint8Array
zip.add("daily.csv", dailyStream); // a ReadableStream<Uint8Array>
let stream = zip.stream(); // ReadableStream<Uint8Array>

return new Response(stream, {
	headers: {
		"content-type": "application/zip",
		"content-disposition": `attachment; filename="report.zip"`,
	},
});
```

| Entry option | Default    | Meaning                                                                                  |
| ------------ | ---------- | ---------------------------------------------------------------------------------------- |
| `modified`   | 1980-01-01 | The entry's DOS timestamp; the fixed default makes the same input produce the same bytes |
| `comment`    | None       | Entry comment in the central directory                                                   |

- **Every entry is stored.** The local header carries method 0, the CRC-32 and both sizes, and
  general-purpose bit 3 is never set, so every unarchiver and streaming reader finds each entry's
  end from its header. This is also exactly the form EPUB requires of `mimetype`.
- **Stream entries are collected before they are written.** A `ReadableStream` entry is read whole
  when `zip.stream()` reaches it, so its CRC-32 and size are known before its header. Memory holds
  one entry at a time, and the API stays the same when DEFLATE and data descriptors arrive.
- **Output is a stream.** `zip.stream()` writes entries in the order they were added, so a Worker
  answers an export of many entries without holding the whole archive. `zip.bytes()` collects the
  stream into a `Result<Uint8Array, ZipError>` for a caller that needs one buffer, as tests and
  `@sdxc/epub` do; the failure is the error the stream would have failed with.
- **Names are UTF-8** with bit 11 set, `/`-separated, and checked: an empty segment, `.` or `..`,
  a leading `/`, a backslash or a duplicate name fails `invalid-entry` when added.
- **Failures are values.** `add` answers `Result<void, ZipError>`; a source stream that errors while
  being read errors the output stream with a `ZipError` carrying the source error as `cause`, since
  a response already under way has no other channel. Codes: `invalid-entry`, `too-large` (an entry
  over 4 GiB or the 65,536th entry, since ZIP64 is not written), `source-failed`.
- **`crc32(bytes, previous?)`** is exported, since PNG output deferred in
  [ADR-115](./ADR-115-qr-package.md) needs the same checksum. The table is built on first use, so
  importing the module does no work in the Worker's global scope.

Reading archives and DEFLATE are out of scope; see [Out of scope](#out-of-scope).

#### README

The package README states in its introduction that entries are stored uncompressed, what that costs
(text-heavy archives are three to four times larger than a compressed equivalent), and that
compression is planned. Its usage section carries these examples:

```typescript
// A download built from strings and bytes
import { Zip } from "@sdxc/zip";

let zip = new Zip();
zip.add("README.txt", "Exported on 2026-10-08\n");
zip.add("feeds.opml", opml);
zip.add("images/avatar.png", avatarBytes, { modified: new Date("2026-10-01T00:00:00Z") });

return new Response(zip.stream(), {
	headers: {
		"content-type": "application/zip",
		"content-disposition": `attachment; filename="export.zip"`,
	},
});
```

```typescript
// Entries produced as streams, written one after another
let zip = new Zip();
for (let kind of ["summary", "daily", "incidents"]) {
	let added = zip.add(`reports/${kind}.csv`, reportStream(kind));
	if (isFailure(added)) return badRequest(added.error.message);
}
return new Response(zip.stream(), { headers: { "content-type": "application/zip" } });
```

```typescript
// The whole archive as bytes, for a test or a stored object
let bytes = await zip.bytes();
if (isFailure(bytes)) throw bytes.error;
await env.EXPORTS.put(`exports/${userId}.zip`, bytes.data);
```

```typescript
// CRC-32 on its own, over one buffer or incrementally across chunks
import { crc32 } from "@sdxc/zip";

crc32(new TextEncoder().encode("123456789")); // 0xcbf43926
let running = 0;
for (let chunk of chunks) running = crc32(chunk, running);
```

It also shows the failure cases a caller handles: a rejected name (`invalid-entry`), the entry limit
(`too-large`), and a source stream that errors mid-response (`source-failed` on the output stream).

### `@sdxc/epub`

```typescript
import { EPUB } from "@sdxc/epub";

let built = EPUB.build({
	metadata: {
		identifier: "urn:uuid:5f1c2a86-…", // stable per book, never per download
		title: "React Router OAuth2 Handbook: OAuth2 in Simple Terms",
		language: "en",
		modified: new Date("2026-10-08T00:00:00Z"),
		creators: [{ name: "…", role: "aut" }],
		publisher: "…",
		description: "A sample chapter of …",
		rights: "© 2026 …",
		accessibility: { summary: "…", modes: ["textual"], features: ["structuralNavigation"] },
	},
	cover: { image: { path: "images/cover.jpg", bytes: coverBytes }, alt: "…" },
	styles: [{ path: "styles/book.css", text: css }],
	chapters: [{ id: "oauth2-simple-terms", title: "OAuth2 in Simple Terms", body: xhtml }],
	resources: [{ path: "images/flow.svg", bytes: flowSvg }],
});
// Result<EPUB, EpubError>

built.data.stream(); // ReadableStream<Uint8Array>, `application/epub+zip`
```

`EPUB.build` is synchronous and answers the first failure it finds. Every file of the publication
is already in memory, so `stream()` writes them through `@sdxc/zip` without waiting on any source.
`bytes()` answers `Result<Uint8Array, ZipError>` like `zip.bytes()`, and `files` lists every file of
the container as `{ path, bytes }` in archive order, which is what the golden fixtures are written
from. `labels` sets the navigation document's headings and landmark text for a book not written in
English.

#### Chapters

A chapter's `body` is the XHTML that goes inside `<body>`, as a string. The package wraps it in a
complete content document it owns, with the XHTML and `epub` namespaces declared, `lang` and
`xml:lang` from the metadata (or the chapter's own `language`), a `<title>`, and a link to every
stylesheet.

Every body is parsed with `@sdxc/xml` using `whitespace: "preserve"`, so a space between two inline
elements and every line of a `<pre>` survive, and serialized back. That one round trip:

- **verifies well-formedness**, answering `invalid-content` with the chapter id and the parser's
  position;
- **removes named entities**, since `@sdxc/xml` resolves the XHTML entity sets and serializes only
  the five XML predefines, so `&nbsp;` from any source arrives as U+00A0;
- **gives the package a tree** to derive manifest properties from and to check references in.

A chapter written in Markdown goes through `toHTML(document, { syntax: "xhtml" })`. A chapter
written as `remix/component` JSX is not accepted directly, because its HTML5 string is not XML; an
HTML-to-XHTML path is an open question below.

Chapter options: `id` (an XML NCName, which names the file `text/<id>.xhtml` and the manifest
item), `title` (the table of contents entry and the document `<title>`), `language`, `linear`
(default `true`), and `toc` (default `true`; `false` keeps a chapter in the spine and out of the
table of contents, for a copyright page).

A table of contents nested below chapters comes from `sections: [{ title, fragment }]`, where each
fragment must be an `id` inside that chapter.

#### What the package writes

| Path in the container    | Written from                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `mimetype`               | Always first, stored, no extra field, no data descriptor                                 |
| `META-INF/container.xml` | Fixed, pointing at `EPUB/package.opf`                                                    |
| `EPUB/package.opf`       | Metadata, manifest with derived properties, spine in chapter order                       |
| `EPUB/nav.xhtml`         | `toc` from chapter titles and sections; `landmarks` with `cover`, `toc` and `bodymatter` |
| `EPUB/toc.ncx`           | The same table of contents in EPUB 2 form, unless `legacyNcx: false`                     |
| `EPUB/cover.xhtml`       | When `cover` is given: a page showing the image with its `alt`, first in the spine       |
| `EPUB/text/<id>.xhtml`   | One per chapter                                                                          |
| `EPUB/<path>`            | Every style and resource at the path the caller gave                                     |

The navigation document is also in the spine, `linear="no"`, after the cover: the `toc` landmark
links to it, and epubcheck reports a link to a document outside the spine (RSC-011).

The cover image carries `cover-image` and is also named by `<meta name="cover">`, which EPUB 3
reading systems ignore and older ones, Kindle's converter among them, read. Every entry is stored,
which OCF allows for all of them; when `@sdxc/zip` gains DEFLATE, XHTML, CSS, SVG and the package
documents switch to it and images and fonts stay stored, since JPEG, PNG, WebP and WOFF2 are
already compressed.

#### Verification

The package enforces what epubcheck reports as fatal or error for the publications it writes, at
build time, so a successful `Result` is a file reading systems open:

| Rule                                                                              | `code`              |
| --------------------------------------------------------------------------------- | ------------------- |
| Required metadata present; `modified` is a valid date; `language` is a BCP 47 tag | `invalid-metadata`  |
| A chapter body is well-formed XML                                                 | `invalid-content`   |
| No `<script>`, no `on*` attribute, no `<form>`                                    | `invalid-content`   |
| Every `src`, `href` on `<link>`, `poster` and `xlink:href` names a manifest item  | `missing-resource`  |
| No remote image, stylesheet or font (an `<a href>` to the web is fine)            | `remote-resource`   |
| A fragment link names an `id` that exists in the target document                  | `missing-resource`  |
| Media type known from the extension and a core media type (EPUB 3.3 adds WebP)    | `unsupported-media` |
| Unique paths and ids; ids are NCNames; paths are inside `EPUB/`                   | `invalid-path`      |
| A chapter out of the spine's linear order and the toc is linked from another one  | `invalid-content`   |

Manifest properties (`svg`, `mathml`, `nav`, `cover-image`) are derived from the parsed tree and
never passed in, so they cannot drift. `scripted` and `remote-resources` are never written, because
the rules above refuse what would need them.

The package does not reimplement epubcheck. Its schema validation, CSS checks and accessibility
report stay with the real tool, which tests run over fixtures (see
[Implementation Plan](#implementation-plan)).

#### Errors

`EpubError` with a `code` from the table above, the chapter or resource `path` it concerns, and the
`@sdxc/xml` error as `cause` where one exists, with one subclass per code as `@sdxc/qr` does so a
`code` check narrows it. A `ZipError` from writing surfaces as the stream's error.

#### Accessibility metadata

`metadata.accessibility` writes the EPUB Accessibility 1.1 properties (`schema:accessMode`,
`schema:accessibilityFeature`, `schema:accessibilityHazard`, `schema:accessibilitySummary`, and
`dcterms:conformsTo` when the caller claims conformance). The package writes none by default,
because a default would be a claim about content it cannot see; the README shows the values a
text-only book with a table of contents honestly carries. An ebook sold to readers in the EU falls
under the European Accessibility Act, so `books` sets them.

### Out of scope

| Feature                                     | Reason                                                                                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Reading EPUB, and reading ZIP               | No consumer imports an ebook or an archive; reading untrusted archives also brings zip bombs and path traversal, which deserve their own design |
| ZIP64                                       | No consumer approaches 4 GiB or 65,535 entries; the writer refuses rather than writing a corrupt archive                                        |
| DEFLATE in `@sdxc/zip`                      | A sample chapter and the first exports are small enough stored; added, with data descriptors for streams, when an archive's size calls for it   |
| Fixed layout, media overlays, scripted EPUB | Reflowable text is every consumer's need                                                                                                        |
| Font obfuscation, encryption, DRM           | Nothing here ships a licensed font or a protected book                                                                                          |
| Fetching remote images                      | The package does no I/O; the app fetches and passes bytes                                                                                       |
| Kindle `.azw3`/`.kfx`                       | Send to Kindle accepts EPUB                                                                                                                     |

## Usage Examples

### `books`: the sample chapter

The chapter is already parsed and painted once per isolate in `sample.tsx`; the EPUB route reuses
that memoized document and builds the file lazily the same way, on first request:

```typescript
let body = toHTML(chapter.data, { syntax: "xhtml" });
let built = EPUB.build({
	metadata: SAMPLE_METADATA,
	styles: [{ path: "styles/book.css", text: bookCss }],
	chapters: [{ id: "oauth2-simple-terms", title: "OAuth2 in Simple Terms", body }],
});
if (isFailure(built)) {
	ctx.log.error("sample.epub_failed", { code: built.error.code, path: built.error.path });
	return notFound("Not Found");
}
return new Response(built.data.stream(), {
	headers: {
		"content-type": "application/epub+zip",
		"content-disposition": `attachment; filename="oauth2-handbook-sample.epub"`,
	},
});
```

`bookCss` carries `@sdxc/highlight`'s token colors, which the app already has in
`resources/css/highlight.css`, since reading systems apply publisher CSS beneath the reader's own
settings.

### `uptime`: several reports in one download

```typescript
let zip = new Zip();
for (let kind of kinds) zip.add(`${kind}.csv`, reportStream(kind));
return attachment(zip.stream(), "reports.zip", "application/zip");
```

## Consequences

### Positive

- **A sample a person can keep:** `books` hands over a file that opens on every e-reader and in
  Send to Kindle.
- **Valid by construction:** well-formedness, entity normalization, references and manifest
  properties are checked by the package, so an app cannot ship an EPUB a reading system refuses.
- **A ZIP writer for everyone:** reports and data exports bundle several files without each app
  writing the container.
- **Runs in a Worker:** Web Streams and `@sdxc/xml`; no Node API, no work at import time.
- **A small ZIP writer:** storing every entry leaves headers, CRC-32 and a central directory, with
  one header layout and no runtime compression to test across runtimes.
- **Reproducible bytes:** a fixed default timestamp and caller-supplied `modified` make output
  byte-stable, so fixtures compare exactly.

### Negative

- **Two packages to own**, and a ZIP writer is the kind of code whose bugs show up only in one
  unarchiver.
- **Larger files:** text is shipped uncompressed, so an EPUB or a CSV export is three to four times
  the size it would be deflated. A sample chapter of about 60 KB of XHTML stays about 60 KB.
- **Stream entries are buffered:** each streamed entry is held whole in memory while it is written,
  which bounds an entry by the Worker's memory until data descriptors arrive with DEFLATE.
- **Chapters are strings parsed again.** A Markdown chapter is rendered to text and re-parsed as
  XML; for chapters of tens of kilobytes the cost is milliseconds.
- **epubcheck needs Java,** so the authoritative check runs outside the usual Vitest run.

### Neutral

- **XHTML is the input contract.** Markdown reaches it through one new renderer option; JSX does
  not reach it yet.
- **`toc.ncx` is written by default** for older reading systems, and costs a few hundred bytes.

## Implementation Plan

### Phase 1: `@sdxc/zip`

**Priority:** High
**Estimated Effort:** 4 hours

1. Create `packages/zip`, public: `Zip` (`add`, `stream`, `bytes`), `crc32`, `ZipError`.
2. Tests under `src/`:
   - `crc32` against the standard check value (`"123456789"` → `0xCBF43926`) and chunked input.
   - Archives written by the package, extracted by a reference reader: `fflate`'s `unzipSync` as a
     devDependency pinned exactly, plus `unzip -t` / `zipinfo` in a Bun child process where present,
     asserting names, bytes, that every entry is method 0, and that bit 3 is never set.
   - Stream entries: chunked sources produce the same bytes as the equivalent `Uint8Array`, and a
     source that errors fails the output with `source-failed`.
   - Name validation, duplicate names, the 65,536-entry limit.
3. README following the package documentation guide, stating that entries are stored uncompressed
   and carrying the usage examples in [README](#readme).

### Phase 2: XHTML from Markdown

**Priority:** High
**Estimated Effort:** 1 hour

1. `toHTML(node, { syntax: "xhtml" })` in `@sdxc/markdown/html`: self-closed task box, booleans as
   `name="name"`, applied to annotation attributes too. Default output is unchanged.
2. A test that renders every node type in the conformance fixtures with `syntax: "xhtml"` and parses
   the output with `@sdxc/xml`.

### Phase 3: `@sdxc/epub`

**Priority:** High
**Estimated Effort:** 8 hours

1. Create `packages/epub`, public: `EPUB.build`, `EPUB` (`stream`, `bytes`), `EpubError` classes.
2. Unit tests per verification rule, each asserting the `code` and `path`.
3. Golden fixtures: a minimal book, a book with cover, nested sections, SVG and an image, and a
   long-form Markdown chapter (tables, task lists, footnotes, code, an alert) rendered with
   `syntax: "xhtml"` as a realistic input; a package keeps no app's content, so the `books` sample
   chapter is exercised by that app's own tests. Built with fixed `modified` and committed as
   expanded directories plus the `.epub` under `src/fixtures` (which the formatter ignores),
   compared byte for byte; `UPDATE_EPUB_FIXTURES=1` rewrites them.
4. `bun run epubcheck` at the package root: downloads the pinned epubcheck release (5.4.0) once
   into `.cache/`, runs it with a local Java or in an `eclipse-temurin:21-jre` container, over
   every golden `.epub` with `--failonwarnings`. Run before committing a fixture change; whether
   CI runs it is an open question.
5. README following the package documentation guide, including the identifier rule and the
   accessibility example.

### Phase 4: Consumers

**Priority:** Medium
**Estimated Effort:** 2 hours per app

1. `books`: an EPUB download of the sample chapter, gated as the app decides, with a cover and
   accessibility metadata; README feature list updated.
2. `blog`: a per-tutorial EPUB, in its own commit and ADR if it needs a route design.
3. `uptime` and `reader`: ZIP exports when each app schedules them.

## Alternatives Considered

### 1. ZIP writing inside `@sdxc/epub`

**Rejected because**: reports and data exports need the same container, and a format capability
gets its own package so its second consumer does not import an ebook builder for it.

### 2. A third-party ZIP library (`fflate`, `JSZip`)

`fflate` is small and fast and implements DEFLATE in JavaScript.

**Rejected because**: a store-only writer is a few hundred lines, every target runtime has native
DEFLATE for when compression arrives, and the package answers a `Result` and enforces the
stored-entry rule EPUB depends on. `fflate` stays as a test-only reference reader.

### 3. DEFLATE from the first version

`CompressionStream("deflate-raw")` would make text entries three to four times smaller.

**Deferred because**: it brings data descriptors for streamed entries, per-entry method choice, a
compression failure path and a workerd test of the runtime's compressor, for archives that are tens
of kilobytes today. The API (`add`, `stream`, `bytes`) stays the same when it is added.

### 4. Chapters as a `Markdown.Document`

`@sdxc/epub` could take Markdown trees and render them itself.

**Rejected because**: it ties the ebook builder to one authoring format. XHTML strings accept
Markdown through one renderer option and accept any other source that can produce XML.

### 5. Chapters as `remix/component` JSX

**Deferred**: the HTML5 serializer is not XML. Converting needs an HTML parser that yields a tree,
which `@sdxc/html` does not expose today. See the open questions.

### 6. EPUB 2

**Rejected because**: EPUB 3 is what every current reading system and Send to Kindle reads; the
NCX that EPUB 2 readers need is written alongside.

## References

- [EPUB 3.3 (W3C Recommendation)](https://www.w3.org/TR/epub-33/)
- [EPUB Reading Systems 3.3](https://www.w3.org/TR/epub-rs-33/)
- [EPUB Accessibility 1.1](https://www.w3.org/TR/epub-a11y-11/)
- [epubcheck](https://github.com/w3c/epubcheck)
- [PKWARE APPNOTE.TXT, ZIP File Format Specification](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)
- [Compression Streams](https://compression.spec.whatwg.org/)
- [Amazon, Send to Kindle supported formats](https://www.amazon.com/gp/help/customer/display.html?nodeId=G5WYD9SAF7PGXRNA)
- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-115: QR Package](./ADR-115-qr-package.md)
- [r3-books ADR-001: Port books to Remix v3](./r3-books/ADR-001-port-books-to-remix-v3.md)

## Current Progress

- [x] Phase 1: `@sdxc/zip`
- [x] Phase 2: XHTML from Markdown
- [x] Phase 3: `@sdxc/epub` — five golden fixtures (minimal, cover, sections, media, long-form
      Markdown) pass epubcheck 5.4.0 with no errors or warnings
- [ ] Phase 4: Consumers
  - [x] `books`: `/sample/download` serves the chapter as an EPUB with a cover and
        accessibility metadata, behind a signed link that expires after an hour; the built
        file passes epubcheck 5.4.0 with no errors or warnings
  - [x] `blog`: every tutorial downloads at `/tutorials/:slug.epub`, the post route's existing
        extension slot beside `.md`, under the same publish, draft and tombstone rules and
        edge cache tag. Site-relative links and fragments become absolute URLs on the blog,
        images become links to the online copy (the package embeds only files it is given, and
        the blog fetches none), and `##`/`###` headings get anchors for a nested table of
        contents. All 164 published tutorials build and pass epubcheck 5.4.0 with no errors or
        warnings
  - [ ] `uptime`, `reader`

## Notes

- Both packages are public from their first commit: a description, a `LICENSE.md`, a row in the
  root README table, and `bun run release:bootstrap` for each.
- `@sdxc/epub` depends on `@sdxc/zip`, `@sdxc/xml` and `@sdxc/result`; it does not depend on
  `@sdxc/markdown`, which a caller uses on its own side.
- The `@sdxc/markdown` change is a separate commit scoped `markdown`, per the one-workspace-per-commit
  rule.

### Open questions

1. **Does CI run epubcheck?** It needs a JVM in the workflow. The alternative is running it locally
   whenever a fixture changes, which a reviewer cannot verify.
2. **HTML input.** Should `@sdxc/html` expose its parsed tree so HTML5 (including `remix/component`
   output) can be converted to XHTML, or should content stay Markdown-first?
3. **Footnotes as pop-ups.** Reading systems show `epub:type="noteref"` / `"footnote"` as pop-ups.
   Should the XHTML mode of `@sdxc/markdown/html` write those attributes, which are EPUB-specific,
   or should `@sdxc/epub` take a hook that rewrites the tree?
4. **Gating the `books` download.** Decided: a signed short-lived link. The unlocked page mints
   `/sample/download?expires=…&signature=…`, an HMAC-SHA-256 under the `SAMPLE_LINK_SECRET`
   secret over a purpose prefix and the expiry, valid for one hour; any other request is
   redirected to the form. The app keeps no session, and the link carries its own proof.
