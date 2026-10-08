# @sdxc/epub

Build EPUB 3.3 publications from XHTML chapters, checked against what epubcheck rejects.

`EPUB.build` takes metadata, chapters and resources and writes the whole container: `mimetype`,
`META-INF/container.xml`, the package document, the navigation document, an EPUB 2 `toc.ncx`,
an optional cover page, one content document per chapter, and every stylesheet and resource. It
refuses at build time what epubcheck reports as an error, so a successful `Result` is a file that
e-readers, phone reading apps and Send to Kindle open.

## Installation

```sh
npm add @sdxc/epub
```

Failures are values from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result). The
container is written by [`@sdxc/zip`](https://www.npmjs.com/package/@sdxc/zip), which stores
every entry uncompressed, and chapters are parsed by
[`@sdxc/xml`](https://www.npmjs.com/package/@sdxc/xml); both install alongside. The package does
no I/O and no work at import time, so it runs in Workers, Bun, Node and the browser.

## Usage

### A One-Chapter Book

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

return new Response(built.data.stream(), {
	headers: {
		"content-type": "application/epub+zip",
		"content-disposition": `attachment; filename="short-book.epub"`,
	},
});
```

The identifier is how a reading system recognises the book in its library. Keep it stable per
book, never per download, or every download becomes a different book.

### Chapters Written In Markdown

`toHTML` from [`@sdxc/markdown`](https://www.npmjs.com/package/@sdxc/markdown) writes the XHTML
a chapter body needs when asked for it:

```typescript
import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";

let parsed = Markdown.parse(source);
if (isFailure(parsed)) throw parsed.error;
let body = toHTML(parsed.data.document, { syntax: "xhtml" });
```

### A Cover, Styles, Images And A Nested Table Of Contents

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
	styles: [{ path: "styles/book.css", text: css }],
	resources: [{ path: "images/map.svg", bytes: mapSvg }],
	chapters: [
		{ id: "copyright", title: "Copyright", body: copyright, toc: false },
		{
			id: "places",
			title: "Places",
			body: `<h1>Places</h1><h2 id="coast">The Coast</h2><img src="../images/map.svg" alt="A map"/>`,
			sections: [{ title: "The Coast", fragment: "coast" }],
		},
	],
});
```

Chapters are written at `EPUB/text/<id>.xhtml`, so a reference inside a body resolves from
`text/`: an image at `images/map.svg` is `../images/map.svg`, and another chapter is
`<id>.xhtml`. Every stylesheet is linked from every chapter.

### Accessibility Metadata

Nothing is written by default, because a default would be a claim about content the package
cannot see. A text-only book with headings and a table of contents honestly carries:

```typescript
metadata: {
	// …
	accessibility: {
		summary: "A text-only publication with structured headings and a table of contents.",
		modes: ["textual"],
		modesSufficient: ["textual"],
		features: ["structuralNavigation", "tableOfContents"],
		hazards: ["none"],
	},
}
```

Add `conformsTo` (for example `"EPUB Accessibility 1.1 - WCAG 2.1 Level AA"`) only once the
publication has been evaluated against it.

## API

### `EPUB.build(input: EPUB.Input): Result<EPUB, EpubError>`

Builds a publication and answers the first rule the input breaks. Each chapter body is parsed as
XML and serialized again, which proves it well-formed, preserves whitespace, and turns named
entities such as `&nbsp;` into the characters they stand for.

| Field       | Default | Meaning                                                                          |
| ----------- | ------- | -------------------------------------------------------------------------------- |
| `metadata`  | —       | `identifier`, `title`, `language` and `modified` are required; see below         |
| `chapters`  | —       | The reading order; at least one is linear and one is in the table of contents    |
| `cover`     | None    | `{ image: { path, bytes }, alt }`; shown first and named as the cover            |
| `styles`    | `[]`    | `{ path, text }` stylesheets, linked from every chapter in order                 |
| `resources` | `[]`    | `{ path, bytes }` images, fonts and audio the chapters and stylesheets reference |
| `legacyNcx` | `true`  | Writes `toc.ncx` for EPUB 2 reading systems and Kindle's converter               |
| `labels`    | English | `contents`, `landmarks`, `cover` and `start` text for the navigation document    |

`metadata` also takes `published`, `creators` (`name`, a MARC relator `role` such as `aut`,
`fileAs`), `publisher`, `description`, `rights`, `subjects` and `accessibility` (`summary`,
`modes`, `modesSufficient`, `features`, `hazards`, `conformsTo`).

A chapter is `{ id, title, body }` plus `language`, `linear` (default `true`), `toc` (default
`true`) and `sections: [{ title, fragment, sections? }]`, where each fragment is an `id` inside
the chapter. The `id` starts with a letter or `_` and uses letters, digits, `.`, `_` and `-`.

Resource and stylesheet paths are relative, `/`-separated, and use `A–Z`, `a–z`, `0–9`, `.`,
`_` and `-`; their media type comes from the extension: CSS, JPEG, PNG, GIF, WebP, SVG, WOFF,
WOFF2, OTF, TTF, MP3 and M4A.

### `EPUB`

A built publication.

#### `epub.stream(): ReadableStream<Uint8Array>`

The `.epub` bytes, `mimetype` first and every entry stored.

#### `epub.bytes(): Promise<Result<Uint8Array, ZipError>>`

The `.epub` in one buffer; it fails only for a publication past 4 GiB.

#### `epub.files: readonly EPUB.File[]`

Every file of the container as `{ path, bytes }`, in archive order, for inspecting or caching
what was built.

### `EpubError`

Carries a `code`, the chapter id or path it concerns as `path`, and the XML parser's error as
`cause` where one exists. Each code has its own subclass, so checking `code` narrows the error.

| Code                | Subclass                   | When                                                                                          |
| ------------------- | -------------------------- | --------------------------------------------------------------------------------------------- |
| `invalid-metadata`  | `EpubMetadataError`        | A required field is empty, a date is invalid, a language is not BCP 47, a role is not MARC    |
| `invalid-content`   | `EpubContentError`         | A body is not well-formed, holds `<script>`, an `on*` attribute, `<form>` or a duplicate `id` |
| `missing-resource`  | `EpubMissingResourceError` | A `src`, `href`, `poster`, `srcset` or CSS `url()` names no file, or a fragment names no `id` |
| `remote-resource`   | `EpubRemoteResourceError`  | An image, stylesheet or font is loaded from the web; links to the web are fine                |
| `unsupported-media` | `EpubMediaTypeError`       | A resource's extension maps to no EPUB core media type                                        |
| `invalid-path`      | `EpubPathError`            | A path or id is malformed, or two differ only in case                                         |

A chapter kept out of both the reading order and the table of contents must be linked from
another chapter, or it fails with `invalid-content`, since a reader could never open it.

### Manifest Properties

`svg`, `mathml`, `nav` and `cover-image` are derived from the content and never passed in, so they
cannot drift from what the chapters hold. `scripted` and `remote-resources` are never needed,
because the rules above refuse what would call for them.

## Pattern: Serving A Book From A Worker

```typescript
import { EPUB } from "@sdxc/epub";
import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { isFailure } from "@sdxc/result";

export async function handleDownload(source: string): Promise<Response> {
	let parsed = Markdown.parse(source);
	if (isFailure(parsed)) return new Response("Not Found", { status: 404 });

	let built = EPUB.build({
		metadata: {
			identifier: "urn:uuid:5f1c2a86-3b1e-4f0c-9d55-0a4e7b1c2d3e",
			title: "A Sample Chapter",
			language: "en",
			modified: new Date("2026-10-08T00:00:00Z"),
		},
		chapters: [
			{
				id: "sample",
				title: "A Sample Chapter",
				body: toHTML(parsed.data.document, { syntax: "xhtml" }),
			},
		],
	});
	if (isFailure(built)) {
		console.error(built.error.code, built.error.path, built.error.message);
		return new Response("Not Found", { status: 404 });
	}

	return new Response(built.data.stream(), {
		headers: {
			"content-type": "application/epub+zip",
			"content-disposition": `attachment; filename="sample.epub"`,
		},
	});
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
