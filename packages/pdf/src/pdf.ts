/**
 * The document: one configured `PDF` registers fonts and images, lays out paragraphs, hands
 * out pages to draw on, and writes everything as a PDF 1.7 file. Output depends only on the
 * calls made, so the same calls with the same `createdAt` write the same bytes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { isSuccess } from "@sdxc/result";

import type { Canvas } from "./canvas.js";
import type { Color as ColorValue } from "./color.js";
import type { EmbeddedFont } from "./font.js";
import type { ImageOptions as ImageBox } from "./image.js";
import type { EmbeddedImage } from "./image.js";
import type { LinkBox as LinkArea } from "./link.js";
import type { Ref } from "./objects.js";
import type { Page as PageClass } from "./page.js";
import type {
	Paragraph as ParagraphClass,
	ParagraphOptions as ParagraphStyle,
	Run as RunValue,
} from "./paragraph.js";
import type { PDFError } from "./pdf-error.js";
import type { LineOptions as LineStyle, RectOptions as RectStyle } from "./shapes.js";
import type { TextOptions as TextStyle } from "./text.js";

import { embedFont } from "./font.js";
import { loadImage } from "./image.js";
import { linkAnnotation } from "./link.js";
import { Name, ObjectTable, Text, deflate, writeFile } from "./objects.js";
import { Page } from "./page.js";
import { layoutParagraph } from "./paragraph.js";

/** Page sizes by name, in points, portrait. */
const PAGE_SIZES = {
	letter: [612, 792],
	legal: [612, 1008],
	a4: [595.28, 841.89],
	a5: [419.53, 595.28],
} as const;

/** The `Producer` every document names in its information dictionary. */
const PRODUCER = "@sdxc/pdf";

/**
 * A PDF document drawn through explicit calls: register fonts and images, add pages, place
 * text, shapes and images on them, then read the file with `stream()` or `bytes()`. The
 * package places nothing on its own and never adds a page by itself.
 *
 * @example let pdf = new PDF({ size: "a4", title: "Invoice" }); let page = pdf.page();
 */
export class PDF {
	#options: PDF.Options;
	#fonts: EmbeddedFont[] = [];
	#images: EmbeddedImage[] = [];
	#pages: Canvas[] = [];

	/**
	 * @param options - Default page size and the document's metadata.
	 */
	constructor(options: PDF.Options = {}) {
		this.#options = options;
	}

	/**
	 * Registers a TrueType font for embedding. A font is written into the file only when some
	 * page draws with it.
	 *
	 * @param bytes - A `.ttf` file.
	 * @returns The font, or a `PDFError` when it cannot be read or its license forbids embedding.
	 * @example let regular = pdf.font(await file.bytes()); if (isFailure(regular)) return regular;
	 */
	font(bytes: Uint8Array): Result<PDF.Font, PDFError> {
		let result = embedFont(bytes, `F${this.#fonts.length + 1}`);
		if (isSuccess(result)) this.#fonts.push(result.data);
		return result;
	}

	/**
	 * Reads a JPEG or PNG for drawing. An image is written into the file once, however many
	 * times pages draw it, and only when some page does.
	 *
	 * @param bytes - The image file.
	 * @returns The image with its pixel size, or a `PDFError` naming why it cannot be used.
	 */
	async image(bytes: Uint8Array): Promise<Result<PDF.Image, PDFError>> {
		let result = await loadImage(bytes, `Im${this.#images.length + 1}`);
		if (isSuccess(result)) this.#images.push(result.data);
		return result;
	}

	/**
	 * Wraps runs of text to a width without drawing them, so the caller can read the height
	 * and split it at a page break before placing it with `page.paragraph()`.
	 *
	 * @param runs - The text, each run optionally overriding the font, size, color or adding a link.
	 * @param options - Width and the style runs inherit.
	 */
	paragraph(runs: PDF.Run[], options: PDF.ParagraphOptions): PDF.Paragraph {
		return layoutParagraph(runs, options);
	}

	/**
	 * Appends a page and returns it for drawing.
	 *
	 * @param options - The page's own size, overriding the document's.
	 */
	page(options: PDF.PageOptions = {}): PDF.Page {
		let [width, height] = dimensions(options.size ?? this.#options.size ?? "letter");
		let canvas: Canvas = {
			width,
			height,
			ops: [],
			fonts: new Set(),
			images: new Set(),
			links: [],
		};
		this.#pages.push(canvas);
		return new Page(canvas);
	}

	/** The finished document as a stream, for a `Response` body. */
	stream(): ReadableStream<Uint8Array> {
		let bytes = () => this.bytes();
		return new ReadableStream<Uint8Array>({
			async start(controller) {
				controller.enqueue(await bytes());
				controller.close();
			},
		});
	}

	/** The finished document's bytes. Reflects every page as drawn when it is called. */
	async bytes(): Promise<Uint8Array> {
		let table = new ObjectTable();
		let catalog = table.allocate();
		let pages = table.allocate();
		let info = table.allocate();

		let usedFonts = new Set(this.#pages.flatMap((page) => [...page.fonts]));
		let fontRefs = new Map<EmbeddedFont, Ref>();
		for (let font of this.#fonts) {
			if (usedFonts.has(font)) fontRefs.set(font, await font.write(table));
		}
		let usedImages = new Set(this.#pages.flatMap((page) => [...page.images]));
		let imageRefs = new Map<EmbeddedImage, Ref>();
		for (let image of this.#images) {
			if (usedImages.has(image)) imageRefs.set(image, await image.write(table));
		}

		let kids: Ref[] = [];
		for (let page of this.#pages) {
			let ref = table.allocate();
			kids.push(ref);
			let content = page.ops.map((op) => (typeof op === "string" ? op : op())).join("\n");
			let contents = table.add({
				dict: { Filter: new Name("FlateDecode") },
				data: await deflate(new TextEncoder().encode(content)),
			});
			let annots = page.links.map((area) => table.add(linkAnnotation(area)));
			let fonts = Object.fromEntries([...page.fonts].map((f) => [f.resource, fontRefs.get(f)]));
			let images = Object.fromEntries([...page.images].map((i) => [i.resource, imageRefs.get(i)]));
			table.set(ref, {
				Type: new Name("Page"),
				Parent: pages,
				MediaBox: [0, 0, page.width, page.height],
				Resources: {
					Font: page.fonts.size > 0 ? fonts : undefined,
					XObject: page.images.size > 0 ? images : undefined,
				},
				Contents: contents,
				Annots: annots.length > 0 ? annots : undefined,
			});
		}

		table.set(pages, { Type: new Name("Pages"), Kids: kids, Count: kids.length });
		let { title, author, subject, keywords, lang, createdAt } = this.#options;
		table.set(catalog, {
			Type: new Name("Catalog"),
			Pages: pages,
			Lang: lang === undefined ? undefined : new Text(lang),
			ViewerPreferences: title === undefined ? undefined : { DisplayDocTitle: true },
		});
		let date = createdAt === undefined ? undefined : new Text(pdfDate(createdAt));
		table.set(info, {
			Title: title === undefined ? undefined : new Text(title),
			Author: author === undefined ? undefined : new Text(author),
			Subject: subject === undefined ? undefined : new Text(subject),
			Keywords: keywords === undefined ? undefined : new Text(keywords.join(", ")),
			Producer: new Text(PRODUCER),
			CreationDate: date,
			ModDate: date,
		});
		return writeFile(table, catalog, info);
	}
}

/**
 * A page size in points.
 *
 * @param size - A named size or `[width, height]`.
 */
function dimensions(size: PDF.Size): [number, number] {
	if (typeof size === "string") return [...PAGE_SIZES[size]];
	return [size[0], size[1]];
}

/**
 * A date as PDF writes it, `D:YYYYMMDDHHmmSSZ`, in UTC so the bytes never depend on the
 * machine's time zone.
 *
 * @param date - The moment.
 */
function pdfDate(date: Date): string {
	let pad = (value: number) => String(value).padStart(2, "0");
	return [
		"D:",
		date.getUTCFullYear(),
		pad(date.getUTCMonth() + 1),
		pad(date.getUTCDate()),
		pad(date.getUTCHours()),
		pad(date.getUTCMinutes()),
		pad(date.getUTCSeconds()),
		"Z",
	].join("");
}

/** The types a `PDF` takes and returns. */
export namespace PDF {
	/** A named page size, or `[width, height]` in points. */
	export type Size = keyof typeof PAGE_SIZES | [number, number];

	/** The document's default page size and metadata. */
	export interface Options {
		/**
		 * The size of every page that sets none of its own.
		 * @default "letter"
		 */
		size?: Size;
		title?: string;
		author?: string;
		subject?: string;
		keywords?: string[];
		/** The document's language as a BCP 47 tag (`"en"`, `"es-AR"`), for screen readers. */
		lang?: string;
		/** Written as the creation and modification date; omitted, the file carries no date and stays byte-stable. */
		createdAt?: Date;
	}

	/** What `pdf.page()` accepts. */
	export interface PageOptions {
		size?: Size;
	}

	/** A `#rrggbb` color. */
	export type Color = ColorValue;
	/** A font registered with `pdf.font()`, which measures text with the metrics it draws with. */
	export type Font = EmbeddedFont;
	/** An image read by `pdf.image()`, with its size in pixels. */
	export type Image = EmbeddedImage;
	/** A page from `pdf.page()`. */
	export type Page = PageClass;
	/** A paragraph from `pdf.paragraph()`, with its lines and height measured. */
	export type Paragraph = ParagraphClass;
	/** A span of a paragraph in its own font, size, color or link. */
	export type Run = RunValue;
	/** The width and inherited style of a paragraph. */
	export type ParagraphOptions = ParagraphStyle;
	/** Where `page.text()` draws a line. */
	export type TextOptions = TextStyle;
	/** What `page.line()` strokes. */
	export type LineOptions = LineStyle;
	/** What `page.rect()` paints. */
	export type RectOptions = RectStyle;
	/** Where `page.image()` draws an image. */
	export type ImageOptions = ImageBox;
	/** The area `page.link()` makes clickable. */
	export type LinkBox = LinkArea;
}
