# @sdxc/pdf

PDF writer with an imperative API: pages, shapes, embedded TrueType text, images and links.

## Installation

```sh
npm add @sdxc/pdf
```

Fonts are read with [`@sdxc/font`](https://www.npmjs.com/package/@sdxc/font) and PNG images with
[`@sdxc/png`](https://www.npmjs.com/package/@sdxc/png); failures are values from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result). All three install alongside.
Compression goes through `CompressionStream`, so it runs in Workers, Bun, Node and the browser.

## Usage

### Draw a page

```typescript
import { PDF } from "@sdxc/pdf";

let pdf = new PDF({ size: "a4", title: "Report" });
let page = pdf.page();
page.rect({ x: 40, y: 40, width: 515, height: 4, fill: "#1d4ed8" });
page.line({ from: [40, 60], to: [555, 60], width: 0.5, color: "#999999" });

return new Response(pdf.stream(), { headers: { "content-type": "application/pdf" } });
```

Lengths are points (1/72 inch), the origin is the page's top-left corner, y grows downward, and
colors are `#rrggbb`.

### Write text with an embedded font

```typescript
import { PDF } from "@sdxc/pdf";
import { isFailure } from "@sdxc/result";

let pdf = new PDF({ title: "Invoice", lang: "en" });
let font = pdf.font(fontBytes); // a .ttf file as a Uint8Array
if (isFailure(font)) return new Response(font.error.message, { status: 500 });

let page = pdf.page();
page.text("Invoice", { x: 40, y: 40, font: font.data, size: 24 });
page.text("$1,200.00", { x: 572, y: 40, font: font.data, size: 24, align: "right" });
```

`y` is the top of the line box. Text is kerned the way `@sdxc/font` measures it, copies and
searches as the original characters, and embeds only the glyphs the document draws.

### Wrap a paragraph with links

```typescript
let paragraph = pdf.paragraph(
	[
		{ text: "Read the " },
		{ text: "full report", href: "https://example.com/report", font: bold.data },
		{ text: " for the details behind every number on this page." },
	],
	{ width: 532, font: regular.data, size: 10, lineHeight: 1.4, align: "justify" },
);
let y = page.paragraph(paragraph, { x: 40, y: 88 }); // the y below its last line
```

Lines break at spaces and after hyphens. A paragraph knows its `height` and `lines` before it is
drawn.

### Embed an image

```typescript
let logo = await pdf.image(pngOrJpegBytes);
if (isFailure(logo)) return new Response(logo.error.message, { status: 422 });
page.image(logo.data, { x: 40, y: 40, width: 120 }); // height keeps the aspect ratio
page.link({ x: 40, y: 40, width: 120, height: 40 }, "https://example.com");
```

## API

### `new PDF(options?: PDF.Options)`

A document. `size` is `"letter"` (default), `"legal"`, `"a4"`, `"a5"` or `[width, height]`;
`title`, `author`, `subject`, `keywords` and `lang` fill the document's metadata, and `createdAt`
sets its date. Without `createdAt` the file carries no date, and the same calls always write the
same bytes.

### `pdf.font(bytes: Uint8Array): Result<PDF.Font, PDFError>`

Registers a TrueType font. A font whose license forbids embedding fails with `restricted-font`;
one whose license forbids subsetting embeds whole. `font.measure(text, size)`,
`font.ascent(size)` and `font.descent(size)` answer in points.

### `pdf.image(bytes: Uint8Array): Promise<Result<PDF.Image, PDFError>>`

Reads a JPEG, written through unchanged, or a PNG, written as RGB with a soft mask when it has
transparency. `image.width` and `image.height` are in pixels.

### `pdf.paragraph(runs: PDF.Run[], options: PDF.ParagraphOptions): PDF.Paragraph`

Wraps runs to `options.width`. Each run may set its own `font`, `size`, `color` and `href`, and
inherits the rest from `options`, which also takes `lineHeight` (a multiple of the font size,
default `1.2`) and `align` (`"left"`, `"center"`, `"right"` or `"justify"`).
`paragraph.split(height)` answers `[fits, rest]` in whole lines, `rest` being `null` when
everything fits.

### `pdf.page(options?: { size?: PDF.Size }): PDF.Page`

Appends a page. The package never adds a page on its own.

### `pdf.stream(): ReadableStream<Uint8Array>` and `pdf.bytes(): Promise<Uint8Array>`

The finished document.

### Page methods

| Method                                                                 | Draws                                                           |
| ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| `text(text, { x, y, font, size, color?, align? })`                     | One line; `align` says whether `x` is its left, center or right |
| `paragraph(paragraph, { x, y })`                                       | A wrapped paragraph; returns the y below its last line          |
| `line({ from, to, width?, color? })`                                   | A straight stroke                                               |
| `rect({ x, y, width, height, fill?, stroke?, strokeWidth?, radius? })` | A rectangle, optionally rounded                                 |
| `image(image, { x, y, width, height? })`                               | An image                                                        |
| `link({ x, y, width, height }, href)`                                  | A clickable area over whatever is drawn there                   |

### `PDFError`

An `Error` with a `code`:

| Code                | When                                                 |
| ------------------- | ---------------------------------------------------- |
| `invalid-font`      | `@sdxc/font` cannot read the file                    |
| `restricted-font`   | The font's license forbids embedding                 |
| `invalid-image`     | A JPEG or PNG is corrupt or truncated                |
| `unsupported-image` | The bytes are neither, or a variant PDF cannot embed |

## Pattern: Flow Paragraphs Across Pages

```typescript
import { PDF } from "@sdxc/pdf";

let margin = 40;
let page = pdf.page();
let y = margin;
for (let paragraph of paragraphs) {
	let rest: PDF.Paragraph | null = paragraph;
	while (rest) {
		let [fits, overflow] = rest.split(page.height - margin - y);
		y = page.paragraph(fits, { x: margin, y }) + 8;
		if (overflow) {
			page = pdf.page();
			y = margin;
		}
		rest = overflow;
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
		"@sdxc/pdf": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
