/**
 * The `sdxc-font inspect` handler: reports each font of a file — names, metrics, glyph and
 * character counts, embedding permission, variable axes and color tables — as aligned text
 * for people or, with `--json`, as `{ file, fonts }` for scripts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import type { Font } from "./font.js";
import type { Axis, NamedInstance } from "./variations/index.js";

import { FONT_COMMANDS } from "./cli-contract.js";
import { readFontInput } from "./cli-input.js";
import { palettes } from "./color/index.js";
import { axes, namedInstances } from "./variations/index.js";

/** The color tables a font may carry, in the order the report lists them. */
const COLOR_TABLES = ["COLR", "CPAL", "SVG ", "sbix", "CBDT", "CBLC"] as const;

/** `truetype` for `glyf` outlines, `cff` or `cff2` for PostScript ones. */
type OutlineFormat = "truetype" | "cff" | "cff2";

/** How the report names each outline format. */
const OUTLINE_LABELS: Record<OutlineFormat, string> = {
	truetype: "TrueType",
	cff: "CFF",
	cff2: "CFF2",
};

/** What `inspect --json` prints for one font; field names and meanings are stable. */
interface FontReport {
	postscriptName: string;
	family: string;
	subfamily: string;
	fullName: string;
	version: string;
	outlines: OutlineFormat;
	unitsPerEm: number;
	ascender: number;
	descender: number;
	lineGap: number;
	capHeight: number | null;
	xHeight: number | null;
	italicAngle: number;
	weightClass: number;
	bbox: Font.BBox;
	glyphCount: number;
	/** How many code points the `cmap` maps to a glyph. */
	characterCount: number;
	embedding: Font.Embedding;
	axes: Axis[];
	namedInstances: NamedInstance[];
	/** Table tags trimmed of padding (`SVG`), and how many `CPAL` palettes there are. */
	color: { tables: string[]; palettes: number };
}

/**
 * Prints one block per font, or one JSON document for the whole file. A file that cannot be
 * read or parsed exits 2 before anything reaches stdout.
 */
export default createCommand(FONT_COMMANDS.inspect, async (ctx) => {
	let input = await readFontInput(ctx, ctx.arguments.font ?? "-");
	if (isFailure(input)) return input;

	let reports = input.data.collection.fonts.map(reportFont);
	if (ctx.flags.json) {
		ctx.stdout(`${JSON.stringify({ file: input.data.name, fonts: reports }, null, 2)}\n`);
		return success();
	}
	ctx.stdout(reports.map(formatReport).join("\n"));
	return success();
});

/**
 * The facts `inspect` reports about `font`, read through the package's public API.
 *
 * @param font - One font of the file
 */
function reportFont(font: Font): FontReport {
	return {
		postscriptName: font.postscriptName,
		family: font.family,
		subfamily: font.subfamily,
		fullName: font.fullName,
		version: font.version,
		outlines: outlineFormat(font),
		unitsPerEm: font.unitsPerEm,
		ascender: font.ascender,
		descender: font.descender,
		lineGap: font.lineGap,
		capHeight: font.capHeight,
		xHeight: font.xHeight,
		italicAngle: font.italicAngle,
		weightClass: font.weightClass,
		bbox: font.bbox,
		glyphCount: font.glyphCount,
		characterCount: font.characterSet.length,
		embedding: font.embedding,
		axes: axes(font),
		namedInstances: namedInstances(font),
		color: {
			tables: COLOR_TABLES.filter((tag) => font.table(tag) !== null).map((tag) => tag.trim()),
			palettes: palettes(font).length,
		},
	};
}

/** Which outline table draws the font's glyphs. */
function outlineFormat(font: Font): OutlineFormat {
	if (font.table("CFF2") !== null) return "cff2";
	if (font.table("CFF ") !== null) return "cff";
	return "truetype";
}

/**
 * One font as a heading and label-aligned lines, ending in a newline; a line whose fact the
 * font lacks (no axes, no color tables, no cap height) is left out.
 *
 * @param report - The facts of one font
 */
function formatReport(report: FontReport): string {
	let rows: [string, string][] = [
		["Family", `${report.family} ${report.subfamily}`],
		["Version", report.version],
		["Outlines", OUTLINE_LABELS[report.outlines]],
		["Glyphs", String(report.glyphCount)],
		["Characters", String(report.characterCount)],
		["Units per em", String(report.unitsPerEm)],
		["Ascender", String(report.ascender)],
		["Descender", String(report.descender)],
		["Line gap", String(report.lineGap)],
	];
	if (report.capHeight !== null) rows.push(["Cap height", String(report.capHeight)]);
	if (report.xHeight !== null) rows.push(["x-height", String(report.xHeight)]);
	rows.push(["Weight", String(report.weightClass)]);
	if (report.italicAngle !== 0) rows.push(["Italic angle", String(report.italicAngle)]);
	rows.push(["Embedding", formatEmbedding(report.embedding)]);
	if (report.axes.length > 0) {
		rows.push([
			"Axes",
			report.axes
				.map((axis) => `${axis.tag} ${axis.min}–${axis.max} (default ${axis.default})`)
				.join(", "),
		]);
	}
	if (report.namedInstances.length > 0) {
		rows.push(["Instances", report.namedInstances.map((named) => named.name).join(", ")]);
	}
	if (report.color.tables.length > 0) {
		let count = report.color.palettes;
		let suffix = count > 0 ? ` (${count} ${count === 1 ? "palette" : "palettes"})` : "";
		rows.push(["Color", `${report.color.tables.join(", ")}${suffix}`]);
	}
	let width = Math.max(...rows.map(([label]) => label.length));
	let lines = rows.map(([label, value]) => `  ${label.padEnd(width)}  ${value}`);
	return `${report.fullName || report.postscriptName} (${report.postscriptName})\n${lines.join("\n")}\n`;
}

/** The `OS/2.fsType` permission, with the subsetting and bitmap-only restrictions it adds. */
function formatEmbedding(embedding: Font.Embedding): string {
	let parts: string[] = [embedding.allowed];
	if (!embedding.subsetting) parts.push("no subsetting");
	if (embedding.bitmapOnly) parts.push("bitmap only");
	return parts.join(", ");
}
