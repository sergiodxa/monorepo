---
title: Generate PDF documents
description: Write an invoice as a PDF inside a Worker, with an embedded font, a logo, right-aligned amounts, a wrapped paragraph holding a link, and terms that flow onto as many pages as they need, and serve it as a download.
section:
    title: Content & feeds
    order: 8
order: 21
lastUpdated: 2026-10-26
outcomes:
    - "How to create a PDF with an embedded font and an image using `@sdxc/pdf`"
    - "How to wrap paragraphs with links and flow them across pages"
    - "How to serve the PDF from a Worker and test what it writes"
---

An invoice, a receipt or a report is a document people save, print and forward, and PDF is the
format every one of those ends in. Rendering HTML to PDF needs a headless browser a Worker does
not have; drawing the page yourself needs only the positions. This guide writes an invoice as a
PDF from the Worker that serves it: a header with a logo, the line items, a note with a payment
link, and terms that continue on a new page when the first one fills.

[`@sdxc/pdf`](/api/pdf) writes the file through explicit drawing calls. It reads fonts with
[`@sdxc/font`](/api/font) and PNG images with [`@sdxc/png`](/api/png), which install alongside,
and uses no WebAssembly.

```bash
npm add @sdxc/http @sdxc/pdf @sdxc/result remix
```

## Bundle the font and the logo

`@sdxc/pdf` embeds TrueType `.ttf` fonts with `glyf` outlines, and images as PNG or JPEG. Rename
each file with a `.bin` extension, for example `resources/fonts/inter-regular.ttf.bin` and
`resources/images/logo.png.bin`: Wrangler and the Cloudflare Vite plugin bundle a `.bin` import
as a data module, which the Worker receives as an `ArrayBuffer`. Declare that shape once for
TypeScript:

```typescript {% title="env.d.ts" %}
declare module "*.bin" {
	const bytes: ArrayBuffer;
	export default bytes;
}
```

The document only embeds the glyphs it draws, so a full font file costs the PDF a few
kilobytes, not the size of the font.

<note>
A font whose license forbids embedding fails with `restricted-font`, and one whose license
forbids subsetting embeds whole. Pick faces whose license allows both, such as Inter's SIL Open
Font License.
</note>

## Create the document

A document takes its default page size and the metadata a PDF reader shows. `pdf.font()` and
`pdf.image()` register the bytes with this document, and each answers a `Result`, so a corrupt
or restricted file is a value to return:

```typescript {% title="app/services/invoices/pdf.ts" %}
import type { PDFError } from "@sdxc/pdf";
import type { Result } from "@sdxc/result";

import { PDF } from "@sdxc/pdf";
import { isFailure, success } from "@sdxc/result";

export interface Invoice {
	number: string;
	customer: string;
	issuedAt: Date;
	dueAt: Date;
	payUrl: string;
	items: { description: string; cents: number }[];
	terms: string[];
}

export interface InvoiceAssets {
	regular: Uint8Array;
	bold: Uint8Array;
	logo: Uint8Array;
}

interface Fonts {
	regular: PDF.Font;
	bold: PDF.Font;
}

const MARGIN = 48;
const WIDTH = 612 - MARGIN * 2;
const RIGHT = MARGIN + WIDTH;
const MUTED = "#71717a";
const RULE = "#e4e4e7";
const ACCENT = "#4f46e5";
const MONEY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export async function invoicePdf(
	invoice: Invoice,
	assets: InvoiceAssets,
): Promise<Result<PDF, PDFError>> {
	let pdf = new PDF({
		size: "letter",
		title: `Invoice ${invoice.number}`,
		author: "Acme",
		lang: "en",
		createdAt: invoice.issuedAt,
	});

	let regular = pdf.font(assets.regular);
	if (isFailure(regular)) return regular;
	let bold = pdf.font(assets.bold);
	if (isFailure(bold)) return bold;
	let logo = await pdf.image(assets.logo);
	if (isFailure(logo)) return logo;

	let fonts = { regular: regular.data, bold: bold.data };
	let page = pdf.page();
	let y = drawHeader(page, invoice, fonts, logo.data);
	y = drawItems(page, invoice.items, fonts, y);
	y = drawNotes(pdf, page, invoice, fonts, y);
	flowTerms(pdf, page, invoice.terms, fonts.regular, y);
	return success(pdf);
}
```

Lengths are points, 1/72 of an inch, so a US Letter page is 612 by 792. The origin is the page's
top-left corner and `y` grows downward, the way you lay out a web page. `lang` is what a screen
reader reads the document in.

The same calls always write the same bytes. `createdAt` dates the file; leave it out and the
file carries no date at all.

## Set the header

`page.image` takes the width to draw at and keeps the aspect ratio, and `page.link` makes an
area clickable over whatever is drawn there. `page.text` sets one line, with `y` at the top of
the line box; `align: "right"` makes `x` the line's right edge, which is how the number lines
up with the margin:

```typescript {% title="app/services/invoices/pdf.ts" %}
function drawHeader(page: PDF.Page, invoice: Invoice, fonts: Fonts, logo: PDF.Image) {
	let width = 96;
	let height = (width * logo.height) / logo.width;
	page.image(logo, { x: MARGIN, y: MARGIN, width });
	page.link({ x: MARGIN, y: MARGIN, width, height }, "https://example.com");

	page.text(`Invoice ${invoice.number}`, {
		x: RIGHT,
		y: MARGIN,
		font: fonts.bold,
		size: 20,
		align: "right",
	});
	page.text(`Issued ${invoice.issuedAt.toISOString().slice(0, 10)}`, {
		x: RIGHT,
		y: MARGIN + 28,
		font: fonts.regular,
		size: 10,
		color: MUTED,
		align: "right",
	});
	page.text(`Billed to ${invoice.customer}`, {
		x: MARGIN,
		y: MARGIN + Math.max(height, 44) + 24,
		font: fonts.regular,
		size: 11,
	});
	return MARGIN + Math.max(height, 44) + 64;
}
```

Each drawing function returns the `y` below what it drew, so the next one starts there.

## Draw the line items

One row per item, the amount aligned right, and a hairline under each row with `page.line`:

```typescript {% title="app/services/invoices/pdf.ts" %}
function drawItems(
	page: PDF.Page,
	items: Invoice["items"],
	fonts: Fonts,
	top: number,
) {
	let y = top;
	for (let item of items) {
		page.text(item.description, { x: MARGIN, y, font: fonts.regular, size: 11 });
		page.text(MONEY.format(item.cents / 100), {
			x: RIGHT,
			y,
			font: fonts.regular,
			size: 11,
			align: "right",
		});
		y += 22;
		page.line({
			from: [MARGIN, y - 7],
			to: [RIGHT, y - 7],
			width: 0.5,
			color: RULE,
		});
	}

	let total = items.reduce((sum, item) => sum + item.cents, 0);
	page.text("Total", { x: MARGIN, y: y + 4, font: fonts.bold, size: 12 });
	page.text(MONEY.format(total / 100), {
		x: RIGHT,
		y: y + 4,
		font: fonts.bold,
		size: 12,
		align: "right",
	});
	return y + 48;
}
```

Text is kerned the way `@sdxc/font` measures it, and copies and searches as the characters you
passed. `font.measure(text, size)` answers a line's width in points before you draw it, for a
description that might run into its amount.

## Wrap a paragraph with a link

`pdf.paragraph` wraps runs of text to a width. Each run may set its own `font`, `size`, `color`
and `href`, and takes the rest from the options; a run with `href` becomes a link on every line
it lands on:

```typescript {% title="app/services/invoices/pdf.ts" %}
function drawNotes(
	pdf: PDF,
	page: PDF.Page,
	invoice: Invoice,
	fonts: Fonts,
	top: number,
) {
	let notes = pdf.paragraph(
		[
			{
				text: `Due ${invoice.dueAt.toISOString().slice(0, 10)}. Pay online at `,
			},
			{
				text: "example.com/pay",
				href: invoice.payUrl,
				font: fonts.bold,
				color: ACCENT,
			},
			{
				text: ", or reply to the email this invoice came with for a bank transfer.",
			},
		],
		{ width: WIDTH, font: fonts.regular, size: 10, lineHeight: 1.5 },
	);
	return page.paragraph(notes, { x: MARGIN, y: top }) + 24;
}
```

Lines break at spaces and after hyphens. `lineHeight` is a multiple of the font size, and
`align` takes `"left"`, `"center"`, `"right"` or `"justify"`. `page.paragraph` returns the `y`
below the last line.

## Flow the terms across pages

A paragraph knows its `lines` and `height` before it is drawn, and `split(height)` answers the
lines that fit in a height and the rest, or `null` when everything fits. Draw what fits, open a
page, and continue with the rest:

```typescript {% title="app/services/invoices/pdf.ts" %}
function flowTerms(
	pdf: PDF,
	first: PDF.Page,
	terms: string[],
	font: PDF.Font,
	top: number,
) {
	let page = first;
	let y = top;
	for (let term of terms) {
		let rest: PDF.Paragraph | null = pdf.paragraph([{ text: term }], {
			width: WIDTH,
			font,
			size: 9,
			color: MUTED,
			align: "justify",
		});
		while (rest) {
			let [fits, overflow] = rest.split(page.height - MARGIN - y);
			y = page.paragraph(fits, { x: MARGIN, y }) + 8;
			if (overflow) {
				page = pdf.page();
				y = MARGIN;
			}
			rest = overflow;
		}
	}
}
```

<warning>
A page draws whatever you give it, past its bottom edge included, and the document adds pages
only when you call `pdf.page()`. Anything that can grow, terms or a long list of line items,
needs a check against `page.height` like the one above, or it is cut off on paper.
</warning>

## Serve the PDF

The action finds the invoice, builds the document and streams it. `attachment()` writes the
`Content-Disposition` value that saves it under the invoice's number. `Invoices` is your own
model:

```typescript {% title="app/http/controllers/invoices/pdf.ts" %}
import { attachment } from "@sdxc/http/response";
import { internalServerError, notFound } from "@sdxc/http/response/html";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import Invoices from "~/app/models/invoice";
import { invoicePdf } from "~/app/services/invoices/pdf";
import INTER_BOLD from "~/resources/fonts/inter-bold.ttf.bin";
import INTER_REGULAR from "~/resources/fonts/inter-regular.ttf.bin";
import LOGO from "~/resources/images/logo.png.bin";
import routes from "~/routes/web";

export default createAction(routes.invoices.pdf, async (ctx) => {
	let { id } = s.parse(s.object({ id: s.string() }), ctx.params);
	let invoice = await Invoices.find(ctx.db, id);
	if (invoice === null) return notFound("Not Found");

	let pdf = await invoicePdf(invoice, {
		regular: new Uint8Array(INTER_REGULAR),
		bold: new Uint8Array(INTER_BOLD),
		logo: new Uint8Array(LOGO),
	});
	if (isFailure(pdf)) {
		ctx.log.fail(pdf.error, { invoice: id, code: pdf.error.code });
		return internalServerError("This invoice could not be written as a PDF.");
	}

	return new Response(pdf.data.stream(), {
		headers: {
			"Content-Type": "application/pdf",
			"Content-Disposition": attachment(`invoice-${invoice.number}.pdf`),
		},
	});
});
```

`stream()` is the body for a `Response`; `bytes()` answers the same file as one `Uint8Array`, to
store it in R2 or attach it to an email. A failure is a `PDFError` whose `code` is
`invalid-font`, `restricted-font`, `invalid-image` or `unsupported-image`, which is what to log.

<warning>
An invoice names a customer and what they paid. Map this route behind the same authorization
check as the invoice's page, so an id in the URL is not enough to download it.
</warning>

## Test the document

The service takes the font and logo bytes as input, so a test reads them from disk. Page objects
are written as text, so counting `/Type /Page` in the file counts its pages:

```typescript {% title="app/services/invoices/pdf.test.ts" %}
import { readFileSync } from "node:fs";

import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { invoicePdf } from "~/app/services/invoices/pdf";

const ASSETS = {
	regular: read("fonts/inter-regular.ttf.bin"),
	bold: read("fonts/inter-bold.ttf.bin"),
	logo: read("images/logo.png.bin"),
};

const INVOICE = {
	number: "2026-0042",
	customer: "Jane Doe",
	issuedAt: new Date("2026-10-01T00:00:00Z"),
	dueAt: new Date("2026-10-31T00:00:00Z"),
	payUrl: "https://example.com/pay/2026-0042",
	items: [{ description: "Hosting, October", cents: 120000 }],
	terms: ["Payment is due within thirty days of the issue date."],
};

function read(path: string) {
	return new Uint8Array(
		readFileSync(new URL(`../../../resources/${path}`, import.meta.url)),
	);
}

function pageCount(bytes: Uint8Array) {
	return (
		new TextDecoder("latin1").decode(bytes).match(/\/Type \/Page\b/g)?.length ?? 0
	);
}

test("a short invoice fits on one page", async () => {
	let bytes = await unwrap(await invoicePdf(INVOICE, ASSETS)).bytes();
	expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe("%PDF-");
	expect(pageCount(bytes)).toBe(1);
});

test("long terms continue on the next pages", async () => {
	let terms = Array.from({ length: 40 }, () =>
		"Late payments accrue interest. ".repeat(20),
	);
	let bytes = await unwrap(await invoicePdf({ ...INVOICE, terms }, ASSETS)).bytes();
	expect(pageCount(bytes)).toBeGreaterThan(1);
});
```

## Where to go next

- [Offer posts as EPUB ebooks](/docs/content-and-feeds/ebooks) — the format for long text a
  reader reflows, where a PDF keeps your layout.
- [Send email](/docs/data-and-background-work/send-email) — the message that tells a customer
  their invoice is ready.
- [`@sdxc/pdf`](/api/pdf) — rectangles with rounded corners, every page size and the full
  paragraph options.
