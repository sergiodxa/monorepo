# @sdxc/epub

Build EPUB 3.3 publications from XHTML chapters, checked against what epubcheck rejects.

`EPUB.build` takes metadata, chapters and resources and writes the whole container: `mimetype`,
`container.xml`, the package and navigation documents, an EPUB 2 `toc.ncx`, an optional cover
page, one content document per chapter, and every stylesheet and resource. Whatever epubcheck
reports as an error comes back as a failure at build time, so a successful build is a file
e-readers, reading apps and Send to Kindle open.

## Installation

```sh
npm add @sdxc/epub
```

Failures are values from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result); the
container is written by [`@sdxc/zip`](https://www.npmjs.com/package/@sdxc/zip) and chapters are
parsed by [`@sdxc/xml`](https://www.npmjs.com/package/@sdxc/xml), both installed alongside. The
package does no I/O, so it runs in Workers, Bun, Node and the browser.

## Usage

### Build a book

```typescript
import { EPUB } from "@sdxc/epub";
import { isFailure } from "@sdxc/result";

let built = EPUB.build({
	metadata: {
		identifier: "urn:uuid:5f1c2a86-3b1e-4f0c-9d55-0a4e7b1c2d3e",
		title: "A Short Book",
		language: "en",
		modified: new Date("2026-10-08T00:00:00Z"),
	},
	chapters: [{ id: "one", title: "Chapter One", body: "<h1>Chapter One</h1><p>Hello.</p>" }],
});
if (isFailure(built)) throw built.error;
```

The identifier is how a reading system recognises the book in its library: keep it stable per
book, so every download of it is the same book.

### Send the file

```typescript
let response = new Response(built.data.stream(), {
	headers: {
		"content-type": "application/epub+zip",
		"content-disposition": `attachment; filename="short-book.epub"`,
	},
});

let bytes = await built.data.bytes(); // Result<Uint8Array, ZipError>
```

### Add a cover, styles and images

```typescript
let built = EPUB.build({
	metadata: {
		identifier: "urn:isbn:9780000000000",
		title: "Pictures and Places",
		language: "en",
		modified: new Date("2026-10-08T00:00:00Z"),
		creators: [{ name: "Jane Doe", role: "aut", fileAs: "Doe, Jane" }],
		publisher: "Example Press",
	},
	cover: { image: { path: "images/cover.jpg", bytes: coverBytes }, alt: "A lighthouse at dusk" },
	styles: [{ path: "styles/book.css", text: "body { line-height: 1.5; }" }],
	resources: [{ path: "images/map.svg", bytes: mapBytes }],
	chapters: [
		{
			id: "places",
			title: "Places",
			body: `<h1>Places</h1><img src="../images/map.svg" alt="A map"/>`,
		},
	],
});
```

Chapters are written at `text/<id>.xhtml`, so a body references a file as `../<path>` and another
chapter as `<id>.xhtml`. Every stylesheet is linked from every chapter, in order.

### Handle a failure

```typescript
if (isFailure(built)) {
	let { code, path, message } = built.error;
	return new Response(`${code} in ${path ?? "input"}: ${message}`, { status: 422 });
}
```

The error names the rule the input broke as `code` and the chapter id or file path as `path`.

## API

### `EPUB.build(input: EPUB.Input): Result<EPUB, EpubError>`

Builds a publication, or answers the first rule the input breaks. Each chapter body is parsed as
XML and serialized again, which turns named entities such as `&nbsp;` into characters. Manifest
properties (`svg`, `mathml`, `nav`, `cover-image`) are derived from the content.

| Field       | Default | Meaning                                                               |
| ----------- | ------- | --------------------------------------------------------------------- |
| `metadata`  | —       | `EPUB.Metadata`                                                       |
| `chapters`  | —       | The reading order; at least one is linear and one is in the contents  |
| `cover`     | None    | `{ image: { path, bytes }, alt }`, shown first and named as the cover |
| `styles`    | `[]`    | `{ path, text }` stylesheets, linked from every chapter               |
| `resources` | `[]`    | `{ path, bytes }` images, fonts and audio the chapters and styles use |
| `legacyNcx` | `true`  | Writes `toc.ncx` for EPUB 2 reading systems and Kindle's converter    |
| `labels`    | English | `contents`, `landmarks`, `cover` and `start` text of the navigation   |

Resource and stylesheet paths are relative, `/`-separated, use `A–Z`, `a–z`, `0–9`, `.`, `_`
and `-`, and stay unique ignoring case. The media type comes from the extension: CSS, JPEG, PNG,
GIF, WebP, SVG, WOFF, WOFF2, OTF, TTF, MP3 or M4A.

### `EPUB`

A built publication; `EPUB.build` is the only way to get one.

#### `epub.stream(): ReadableStream<Uint8Array>`

The `.epub` bytes, `mimetype` first and every entry stored uncompressed.

#### `epub.bytes(): Promise<Result<Uint8Array, ZipError>>`

The `.epub` in one buffer; it fails only for a publication past 4 GiB.

#### `epub.files: readonly EPUB.File[]`

Every file of the container as `{ path, bytes }`, in archive order.

### `EpubError`

Carries `code`, the chapter id or path it concerns as `path`, and the XML parser's error as
`cause` where one exists. Each code has its own subclass, so checking `code` narrows the error.

| Code                | Subclass                   | When                                                                                    |
| ------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| `invalid-metadata`  | `EpubMetadataError`        | A required field or title is empty, a date is invalid, a language is not BCP 47         |
| `invalid-content`   | `EpubContentError`         | A body is malformed or holds `<script>`, `on*`, `<form>` or a duplicate `id`            |
| `missing-resource`  | `EpubMissingResourceError` | A `src`, `href`, `poster`, `srcset` or CSS `url()` names no file, or a fragment no `id` |
| `remote-resource`   | `EpubRemoteResourceError`  | An image, stylesheet or font loads from the web (links to the web are fine)             |
| `unsupported-media` | `EpubMediaTypeError`       | A resource's extension maps to no EPUB core media type                                  |
| `invalid-path`      | `EpubPathError`            | A path or id is malformed, or two differ only in case                                   |

A chapter with both `linear: false` and `toc: false` must be linked from another chapter, or it fails
with `invalid-content`.

### Types

#### `EPUB.Input`

The argument of `EPUB.build`, described in the table above.

#### `EPUB.Metadata`

`identifier`, `title`, `language` (a BCP 47 tag, also every chapter's default) and `modified`
are required; `published`, `creators`, `publisher`, `description`, `rights`, `subjects` and
`accessibility` are optional.

#### `EPUB.Creator`

`{ name, role?, fileAs? }`, where `role` is a MARC relator code such as `aut`, `edt` or `ill`.

#### `EPUB.Accessibility`

`summary`, `modes`, `modesSufficient`, `features`, `hazards` and `conformsTo`, written as the
schema.org properties EPUB Accessibility 1.1 asks for. Nothing is written unless given.

#### `EPUB.Chapter`

`{ id, title, body }` plus `language`, `linear` (default `true`), `toc` (default `true`) and
`sections`. The `id` starts with a letter or `_` and uses letters, digits, `.`, `_` and `-`.

#### `EPUB.Section`

`{ title, fragment, sections? }`, a contents entry nested under its chapter, opening at the
element whose `id` is `fragment`.

#### `EPUB.Cover`, `EPUB.Style`, `EPUB.Resource`, `EPUB.Labels`, `EPUB.File`

The shapes of `cover`, `styles`, `resources`, `labels` and `files` listed above.

#### `EpubError.Code`

The union of the six codes.

## Pattern: Downloading Markdown As A Book

`toHTML` from [`@sdxc/markdown`](https://www.npmjs.com/package/@sdxc/markdown) writes the XHTML
a chapter body needs.

```typescript
import { EPUB } from "@sdxc/epub";
import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { isFailure } from "@sdxc/result";

export function download(id: string, title: string, chapters: string[]): Response {
	let bodies: EPUB.Chapter[] = [];
	for (let [index, source] of chapters.entries()) {
		let parsed = Markdown.parse(source);
		if (isFailure(parsed)) return new Response("Invalid chapter", { status: 422 });
		bodies.push({
			id: `chapter-${index + 1}`,
			title: `Chapter ${index + 1}`,
			body: toHTML(parsed.data.document, { syntax: "xhtml" }),
		});
	}

	let built = EPUB.build({
		metadata: { identifier: `urn:uuid:${id}`, title, language: "en", modified: new Date() },
		chapters: bodies,
	});
	if (isFailure(built)) return new Response(built.error.message, { status: 422 });

	return new Response(built.data.stream(), {
		headers: {
			"content-type": "application/epub+zip",
			"content-disposition": `attachment; filename="${id}.epub"`,
		},
	});
}
```

## Pattern: A Nested Table Of Contents With Front And Back Matter

`sections` nest entries under a chapter, `toc: false` keeps a copyright page out of the
contents, and `linear: false` takes notes out of the reading order, reached by a link.

```typescript
import { EPUB } from "@sdxc/epub";

let built = EPUB.build({
	metadata: {
		identifier: "urn:uuid:0b6e1d0a-7c55-4d7f-8a59-0d3b9e2f4c11",
		title: "A Field Guide",
		language: "en",
		modified: new Date("2026-10-08T00:00:00Z"),
	},
	chapters: [
		{ id: "copyright", title: "Copyright", body: "<p>© 2026 Jane Doe</p>", toc: false },
		{
			id: "birds",
			title: "Birds",
			body: `<h1>Birds</h1><h2 id="owls">Owls</h2><p>See <a href="notes.xhtml#n1">note 1</a>.</p><h3 id="barn">Barn Owl</h3>`,
			sections: [
				{ title: "Owls", fragment: "owls", sections: [{ title: "Barn Owl", fragment: "barn" }] },
			],
		},
		{
			id: "notes",
			title: "Notes",
			body: `<p id="n1">Seen at dusk.</p>`,
			linear: false,
			toc: false,
		},
	],
});
```

## Pattern: A Book In Another Language

`language` on the metadata sets every chapter's language, a chapter may override it, and
`labels` translates the navigation's headings.

```typescript
import { EPUB } from "@sdxc/epub";

let built = EPUB.build({
	metadata: {
		identifier: "urn:isbn:9780000000001",
		title: "Cuentos",
		language: "es-419",
		modified: new Date("2026-10-08T00:00:00Z"),
		published: new Date("2024-03-01T00:00:00Z"),
		creators: [{ name: "Ana Pérez", role: "aut", fileAs: "Pérez, Ana" }],
		subjects: ["Fiction"],
	},
	labels: {
		contents: "Índice",
		landmarks: "Puntos de referencia",
		cover: "Portada",
		start: "Inicio",
	},
	chapters: [
		{ id: "uno", title: "Uno", body: "<h1>Uno</h1><p>Había una vez…</p>" },
		{ id: "quote", title: "Epigraph", body: "<p>Once upon a time…</p>", language: "en" },
	],
});
```

## Pattern: Declaring Accessibility

Accessibility metadata is a claim about the content, so the caller states it. A text-only book
with headings and a table of contents carries:

```typescript
import { EPUB } from "@sdxc/epub";

let built = EPUB.build({
	metadata: {
		identifier: "urn:uuid:5f1c2a86-3b1e-4f0c-9d55-0a4e7b1c2d3e",
		title: "A Short Book",
		language: "en",
		modified: new Date("2026-10-08T00:00:00Z"),
		accessibility: {
			summary: "A text-only publication with structured headings and a table of contents.",
			modes: ["textual"],
			modesSufficient: ["textual"],
			features: ["structuralNavigation", "tableOfContents"],
			hazards: ["none"],
		},
	},
	chapters: [{ id: "one", title: "Chapter One", body: "<h1>Chapter One</h1><p>Hello.</p>" }],
});
```

Add `conformsTo`, such as `"EPUB Accessibility 1.1 - WCAG 2.1 Level AA"`, once the publication
has been evaluated against it.

## Pattern: Reporting What To Fix

Each code narrows the error, so a form can point the author at the chapter or file to change.

```typescript
import { EPUB } from "@sdxc/epub";
import { isFailure } from "@sdxc/result";

function explain(input: EPUB.Input): string | null {
	let built = EPUB.build(input);
	if (!isFailure(built)) return null;

	let error = built.error;
	switch (error.code) {
		case "remote-resource":
			return `Upload the file "${error.path}" loads from the web instead of linking it.`;
		case "missing-resource":
			return `Something in "${error.path}" points at a file or anchor that is missing.`;
		case "invalid-content":
			return `Fix the markup of "${error.path}": ${error.message}`;
		default:
			return error.message;
	}
}
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/epub": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
