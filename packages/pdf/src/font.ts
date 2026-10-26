/**
 * A TrueType font registered with a document: it measures text with `@sdxc/font`, records
 * which glyphs the document draws, and writes itself as a `Type0` font with a `CIDFontType2`
 * descendant, a `W` array and a `ToUnicode` map when the file is written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Font } from "@sdxc/font";
import type { Result } from "@sdxc/result";

import { parseFont } from "@sdxc/font";
import { failure, isFailure, success } from "@sdxc/result";

import type { Dict, ObjectTable, Ref } from "./objects.js";

import { Name, Text, deflate, latin1, num } from "./objects.js";
import { PDFError } from "./pdf-error.js";

/**
 * `FontDescriptor` flag bits, ISO 32000-1 table 123. Every font is declared nonsymbolic,
 * since text maps to it through Unicode and glyph ids rather than a symbol encoding.
 */
const FLAGS = { fixedPitch: 1, serif: 2, nonsymbolic: 32, italic: 64 } as const;

/** The most entries one `beginbfchar` section may hold. */
const BFCHAR_CHUNK = 100;

/** The code point `encode` adds word spacing after. */
const SPACE = 0x20;

/** One step of an encoded line: a glyph to show or a `TJ` adjustment in thousandths of an em. */
type Piece = { glyph: number } | { adjust: number };

/**
 * A font a document embeds. Obtain one from `pdf.font()`; it belongs to that document and
 * only draws on its pages.
 */
export class EmbeddedFont {
	/** The resource name pages list the font under (`F1`, `F2`, …). */
	readonly resource: string;
	/** The parsed font, for measuring and laying out text beyond what this class answers. */
	readonly font: Font;

	#bytes: Uint8Array;
	/** Every glyph drawn, in first-use order, with the text it was first drawn for. */
	#used = new Map<number, string>();
	/** The character id text writes for a glyph, decided by `write()` once the subset exists. */
	#cid: (glyph: number) => number = (glyph) => glyph;

	/**
	 * @param font - The font `@sdxc/font` parsed.
	 * @param bytes - The font file, embedded whole when the font cannot be subset.
	 * @param resource - The page resource name.
	 */
	constructor(font: Font, bytes: Uint8Array, resource: string) {
		this.font = font;
		this.#bytes = bytes;
		this.resource = resource;
	}

	/**
	 * The width of a line of text at a size, kerning included, in points.
	 *
	 * @param text - One line.
	 * @param size - Font size in points.
	 */
	measure(text: string, size: number): number {
		return this.font.measure(text, size);
	}

	/**
	 * Distance from the top of the line box to the baseline at a size, in points.
	 *
	 * @param size - Font size in points.
	 */
	ascent(size: number): number {
		return (this.font.ascender * size) / this.font.unitsPerEm;
	}

	/**
	 * Distance from the baseline to the bottom of the line box at a size, positive, in points.
	 *
	 * @param size - Font size in points.
	 */
	descent(size: number): number {
		return (-this.font.descender * size) / this.font.unitsPerEm;
	}

	/**
	 * The `TJ` operand that shows `text` at `size`: glyph ids as hex strings with each
	 * kerning pair as an adjustment, and `wordSpacing` extra points after every space.
	 * Resolved when the file is written, so the ids match the embedded subset.
	 *
	 * @param text - One line.
	 * @param size - Font size in points.
	 * @param wordSpacing - Extra points after each space, for justified lines.
	 */
	encode(text: string, size: number, wordSpacing = 0): () => string {
		let pieces: Piece[] = [];
		let previous = -1;
		for (let character of text) {
			let codePoint = character.codePointAt(0) ?? 0;
			let glyph = this.font.glyphIndex(codePoint);
			if (previous >= 0) {
				let kern = this.font.kerning(previous, glyph);
				if (kern !== 0) pieces.push({ adjust: (-kern * 1000) / this.font.unitsPerEm });
			}
			pieces.push({ glyph });
			if (!this.#used.has(glyph)) this.#used.set(glyph, character);
			if (codePoint === SPACE && wordSpacing !== 0 && size > 0) {
				pieces.push({ adjust: (-wordSpacing * 1000) / size });
			}
			previous = glyph;
		}
		return () => tjArray(pieces, this.#cid);
	}

	/**
	 * Writes the font's objects and answers the reference of its `Type0` dictionary. Embeds a
	 * subset of the glyphs drawn so far when the license allows it, and the whole file when it
	 * does not or the subset cannot be built; either way the text written afterwards uses the
	 * ids of the font actually embedded.
	 *
	 * @param table - The document's objects.
	 */
	async write(table: ObjectTable): Promise<Ref> {
		let glyphs = [...this.#used.keys()];
		let file = this.#bytes;
		let baseFont = postscriptName(this.font, this.resource);
		this.#cid = (glyph) => glyph;
		if (this.font.embedding.subsetting) {
			let subset = this.font.subset(glyphs);
			if (!isFailure(subset)) {
				let mapping = subset.data;
				file = mapping.bytes;
				this.#cid = (glyph) => mapping.glyphId(glyph);
				baseFont = `${subsetTag(baseFont, glyphs)}+${baseFont}`;
			}
		}

		let scale = 1000 / this.font.unitsPerEm;
		let byCid = glyphs
			.map((glyph) => ({ glyph, cid: this.#cid(glyph), text: this.#used.get(glyph) ?? "" }))
			.sort((a, b) => a.cid - b.cid);

		let fontFile = table.add({
			dict: { Length1: file.length, Filter: new Name("FlateDecode") },
			data: await deflate(file),
		});
		let descriptor = table.add(this.#descriptor(baseFont, fontFile, scale));
		let widths = widthArray(
			byCid.map(({ glyph, cid }) => ({ cid, width: this.font.advance(glyph) * scale })),
		);
		let descendant = table.add({
			Type: new Name("Font"),
			Subtype: new Name("CIDFontType2"),
			BaseFont: new Name(baseFont),
			CIDSystemInfo: { Registry: new Text("Adobe"), Ordering: new Text("Identity"), Supplement: 0 },
			FontDescriptor: descriptor,
			W: widths,
			CIDToGIDMap: new Name("Identity"),
		});
		let mapped = byCid.filter(({ cid, text }) => cid !== 0 && text !== "");
		let toUnicode = table.add({
			dict: { Filter: new Name("FlateDecode") },
			data: await deflate(latin1(toUnicodeCMap(mapped))),
		});
		return table.add({
			Type: new Name("Font"),
			Subtype: new Name("Type0"),
			BaseFont: new Name(baseFont),
			Encoding: new Name("Identity-H"),
			DescendantFonts: [descendant],
			ToUnicode: toUnicode,
		});
	}

	/**
	 * The `FontDescriptor`, with every metric in the thousandths of an em PDF glyph space uses.
	 * A font without a recorded cap height reports its ascender, the nearest metric it has.
	 *
	 * @param baseFont - The `FontName`, subset tag included.
	 * @param fontFile - The `FontFile2` stream.
	 * @param scale - Font units to glyph space.
	 */
	#descriptor(baseFont: string, fontFile: Ref, scale: number): Dict {
		let font = this.font;
		let flags: number = FLAGS.nonsymbolic;
		if (font.isFixedPitch) flags |= FLAGS.fixedPitch;
		if (font.isSerif) flags |= FLAGS.serif;
		if (font.isItalic || font.italicAngle !== 0) flags |= FLAGS.italic;
		let { xMin, yMin, xMax, yMax } = font.bbox;
		return {
			Type: new Name("FontDescriptor"),
			FontName: new Name(baseFont),
			Flags: flags,
			FontBBox: [xMin, yMin, xMax, yMax].map((value) => Math.round(value * scale)),
			ItalicAngle: font.italicAngle,
			Ascent: Math.round(font.ascender * scale),
			Descent: Math.round(font.descender * scale),
			CapHeight: Math.round((font.capHeight ?? font.ascender) * scale),
			XHeight: font.xHeight === null ? undefined : Math.round(font.xHeight * scale),
			StemV: stemV(font.weightClass),
			FontFile2: fontFile,
		};
	}
}

/**
 * Parses a font file and checks that its license allows embedding. A font whose `OS/2.fsType`
 * is restricted, or that allows embedding its bitmaps only, fails with `restricted-font`,
 * since this package embeds outlines.
 *
 * @param bytes - A TrueType font file.
 * @param resource - The page resource name to give it.
 */
export function embedFont(bytes: Uint8Array, resource: string): Result<EmbeddedFont, PDFError> {
	let parsed = parseFont(bytes);
	if (isFailure(parsed)) {
		return failure(
			new PDFError("invalid-font", `The font could not be read: ${parsed.error.message}`, {
				cause: parsed.error,
			}),
		);
	}
	let { allowed, bitmapOnly } = parsed.data.embedding;
	if (allowed === "restricted" || bitmapOnly) {
		return failure(
			new PDFError(
				"restricted-font",
				`The font's license (OS/2 fsType) forbids embedding its outlines: ${allowed}${bitmapOnly ? ", bitmap only" : ""}.`,
			),
		);
	}
	return success(new EmbeddedFont(parsed.data, bytes, resource));
}

/**
 * A `TJ` array: runs of glyphs share one hex string of 4-digit ids, and adjustments sit
 * between them as numbers.
 *
 * @param pieces - Glyphs and adjustments in drawing order.
 * @param cid - The id each glyph is written as.
 * @example tjArray([{ glyph: 36 }, { adjust: 74 }, { glyph: 57 }], (g) => g) // "[<0024> 74 <0039>]"
 */
function tjArray(pieces: Piece[], cid: (glyph: number) => number): string {
	let parts: string[] = [];
	let run = "";
	for (let piece of pieces) {
		if ("glyph" in piece) {
			run += cid(piece.glyph).toString(16).padStart(4, "0").toUpperCase();
			continue;
		}
		if (run !== "") parts.push(`<${run}>`);
		run = "";
		parts.push(num(piece.adjust));
	}
	if (run !== "") parts.push(`<${run}>`);
	return `[${parts.join(" ")}]`;
}

/**
 * The `W` array in its compact form, `[first [w1 w2 …]]` per run of consecutive ids, so a
 * subset's renumbered ids, which are mostly consecutive, write a single run.
 *
 * @param entries - Ids with their advances in glyph space, sorted by id.
 */
function widthArray(entries: { cid: number; width: number }[]): (number | number[])[] {
	let out: (number | number[])[] = [];
	let run: number[] = [];
	let next = -1;
	for (let { cid, width } of entries) {
		if (cid !== next) {
			run = [];
			out.push(cid, run);
		}
		run.push(Math.round(width));
		next = cid + 1;
	}
	return out;
}

/**
 * The `ToUnicode` CMap mapping each character id to the UTF-16BE text it was first drawn
 * for, so a viewer copies and searches the original characters, astral ones as surrogate pairs.
 *
 * @param entries - Ids and their text, sorted by id.
 */
function toUnicodeCMap(entries: { cid: number; text: string }[]): string {
	let lines = [
		"/CIDInit /ProcSet findresource begin",
		"12 dict begin",
		"begincmap",
		"/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
		"/CMapName /Adobe-Identity-UCS def",
		"/CMapType 2 def",
		"1 begincodespacerange",
		"<0000> <FFFF>",
		"endcodespacerange",
	];
	for (let start = 0; start < entries.length; start += BFCHAR_CHUNK) {
		let chunk = entries.slice(start, start + BFCHAR_CHUNK);
		lines.push(`${chunk.length} beginbfchar`);
		for (let { cid, text } of chunk) lines.push(`<${hex4(cid)}> <${utf16(text)}>`);
		lines.push("endbfchar");
	}
	lines.push("endcmap", "CMapName currentdict /CMap defineresource pop", "end", "end");
	return lines.join("\n");
}

/**
 * A number as four upper-case hex digits.
 *
 * @param value - Between 0 and 0xFFFF.
 */
function hex4(value: number): string {
	return value.toString(16).padStart(4, "0").toUpperCase();
}

/**
 * Text as UTF-16BE hex; JavaScript strings already hold UTF-16 code units, surrogates included.
 *
 * @param text - Any text.
 */
function utf16(text: string): string {
	let out = "";
	for (let index = 0; index < text.length; index++) out += hex4(text.charCodeAt(index));
	return out;
}

/**
 * The PostScript name PDF uses as `BaseFont`, built from the family and style when the font
 * records none, and the resource name as a last resort, so the dictionary always names a font.
 *
 * @param font - The parsed font.
 * @param resource - The page resource name.
 */
function postscriptName(font: Font, resource: string): string {
	let fromFont = font.postscriptName.replace(/[^!-~]|[#/%()<>[\]{}]/g, "");
	if (fromFont !== "") return fromFont;
	let fromFamily = `${font.family}-${font.subfamily}`.replace(/[^A-Za-z0-9-]/g, "");
	return fromFamily === "-" ? resource : fromFamily;
}

/**
 * The six upper-case letters PDF prefixes a subset font's name with. Derived from the name
 * and the glyph set by FNV-1a, so the same document always writes the same tag and two
 * different subsets of one font in a file almost never share one.
 *
 * @param name - The PostScript name.
 * @param glyphs - The subset's glyphs.
 */
function subsetTag(name: string, glyphs: number[]): string {
	let hash = 0x811c9dc5;
	let mix = (value: number) => {
		hash ^= value & 0xffff;
		hash = Math.imul(hash, 0x01000193) >>> 0;
	};
	for (let index = 0; index < name.length; index++) mix(name.charCodeAt(index));
	for (let glyph of [...glyphs].sort((a, b) => a - b)) mix(glyph);
	let tag = "";
	for (let index = 0; index < 6; index++) {
		tag += String.fromCharCode(65 + (hash % 26));
		hash = Math.floor(hash / 26);
	}
	return tag;
}

/**
 * Estimates the dominant vertical stem width from the weight class with the common
 * `10 + 220 × ((weight − 50) / 900)²` curve, since TrueType records no stem width; viewers
 * read it only to synthesize a substitute when the embedded font cannot be used.
 *
 * @param weightClass - `OS/2.usWeightClass`.
 * @example stemV(400) // 43
 */
function stemV(weightClass: number): number {
	let ratio = Math.max(0, weightClass - 50) / 900;
	return Math.round(10 + 220 * ratio * ratio);
}
