/**
 * Writes `src/shaping/unicode/unicode.data.ts` from a directory of Unicode Character Database
 * files: `bun packages/font/scripts/generate-unicode.ts <ucd-dir>`, where the directory holds
 * the files in `UCD_FILES`, downloaded from `https://www.unicode.org/Public/<version>/ucd/`.
 * The module is formatted with `vp fmt` afterwards, so a rerun on the same data changes nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Every file the generator reads, flattened into one directory (`extracted/` files included). */
const UCD_FILES = [
	"DerivedGeneralCategory.txt",
	"Scripts.txt",
	"PropertyValueAliases.txt",
	"DerivedCombiningClass.txt",
	"DerivedJoiningType.txt",
	"ArabicShaping.txt",
	"IndicSyllabicCategory.txt",
	"IndicPositionalCategory.txt",
	"BidiMirroring.txt",
	"DerivedCoreProperties.txt",
];

/** One past the last Unicode code point. */
const CODE_POINTS = 0x110000;

/** The data module this script owns; it is rewritten whole on every run. */
const OUTPUT = path.join(import.meta.dirname, "../src/shaping/unicode/unicode.data.ts");

/**
 * Hangul fillers that shaping engines draw as visible glyphs although Unicode lists them
 * as default ignorable; leaving them out keeps a Hangul filler from vanishing.
 */
const VISIBLE_FILLERS = new Set([0x115f, 0x1160, 0x3164, 0xffa0]);

/** A parsed data line: the first and last code point it covers and its fields after the range. */
interface Line {
	first: number;
	last: number;
	fields: string[];
}

/**
 * The data lines of a UCD file, comments stripped. A range `0600..0605` covers both ends.
 *
 * @param directory - The UCD directory.
 * @param name - The file name.
 */
function readLines(directory: string, name: string): Line[] {
	let text = readFileSync(path.join(directory, name), "utf8");
	let lines: Line[] = [];
	for (let raw of text.split("\n")) {
		let content = raw.split("#")[0]?.trim() ?? "";
		if (content === "") continue;
		let fields = content.split(";").map((field) => field.trim());
		let range = fields[0]?.split("..") ?? [];
		let first = Number.parseInt(range[0] ?? "", 16);
		let last = range[1] === undefined ? first : Number.parseInt(range[1], 16);
		lines.push({ first, last, fields: fields.slice(1) });
	}
	return lines;
}

/**
 * The version a UCD file names in its first line (`# Scripts-18.0.0.txt`).
 *
 * @param directory - The UCD directory.
 */
function readVersion(directory: string): string {
	let first = readFileSync(path.join(directory, "Scripts.txt"), "utf8").split("\n")[0] ?? "";
	return /-(\d+\.\d+\.\d+)\.txt/.exec(first)?.[1] ?? "unknown";
}

/**
 * One property for every code point as an index into its value list, starting from the
 * default value and overwritten by each line.
 *
 * @param lines - The file's data lines.
 * @param values - The value list, grown as new values appear; index 0 is the default.
 * @param read - Picks the value from a line's fields.
 */
function fill(lines: Line[], values: string[], read: (fields: string[]) => string): Uint16Array {
	let column = new Uint16Array(CODE_POINTS);
	for (let line of lines) {
		let value = read(line.fields);
		let index = values.indexOf(value);
		if (index === -1) index = values.push(value) - 1;
		column.fill(index, line.first, line.last + 1);
	}
	return column;
}

/** A growable byte buffer of unsigned LEB128 numbers. */
class Varints {
	bytes: number[] = [];

	/** @param value - A non-negative integer. */
	push(value: number) {
		let rest = value;
		while (rest >= 0x80) {
			this.bytes.push((rest & 0x7f) | 0x80);
			rest = Math.floor(rest / 0x80);
		}
		this.bytes.push(rest);
	}

	/** The buffer as base64, the form the data module stores it in. */
	toBase64(): string {
		return Buffer.from(this.bytes).toString("base64");
	}
}

/**
 * Reads every property and writes the data module. Code points share a record when every
 * property agrees, and the table stores one run per change of record.
 */
function main() {
	let directory = process.argv[2];
	if (directory === undefined) {
		process.stderr.write(
			`Usage: bun generate-unicode.ts <ucd-dir> (needs ${UCD_FILES.join(", ")})\n`,
		);
		process.exitCode = 1;
		return;
	}
	let version = readVersion(directory);

	let scriptCodes = new Map<string, string>();
	for (let line of readFileSync(path.join(directory, "PropertyValueAliases.txt"), "utf8").split(
		"\n",
	)) {
		let fields =
			line
				.split("#")[0]
				?.split(";")
				.map((field) => field.trim()) ?? [];
		if (fields[0] === "sc" && fields[1] !== undefined && fields[2] !== undefined) {
			scriptCodes.set(fields[2], fields[1]);
		}
	}

	let categories = ["Cn"];
	let category = fill(
		readLines(directory, "DerivedGeneralCategory.txt"),
		categories,
		(f) => f[0] ?? "",
	);
	let scripts = ["Zzzz"];
	let script = fill(
		readLines(directory, "Scripts.txt"),
		scripts,
		(f) => scriptCodes.get(f[0] ?? "") ?? "Zzzz",
	);
	let classes = ["0"];
	let combining = fill(
		readLines(directory, "DerivedCombiningClass.txt"),
		classes,
		(f) => f[0] ?? "0",
	);
	let joinings = ["U"];
	let joining = fill(readLines(directory, "DerivedJoiningType.txt"), joinings, (f) => f[0] ?? "U");
	for (let line of readLines(directory, "ArabicShaping.txt")) {
		let group = line.fields[2];
		if (group !== "ALAPH" && group !== "DALATH RISH") continue;
		let value = group === "ALAPH" ? "ALAPH" : "DALATH_RISH";
		let index = joinings.indexOf(value);
		if (index === -1) index = joinings.push(value) - 1;
		joining.fill(index, line.first, line.last + 1);
	}
	let syllabics = ["Other"];
	let syllabic = fill(
		readLines(directory, "IndicSyllabicCategory.txt"),
		syllabics,
		(f) => f[0] ?? "",
	);
	let positionals = ["NA"];
	let positional = fill(
		readLines(directory, "IndicPositionalCategory.txt"),
		positionals,
		(f) => f[0] ?? "",
	);

	let columns = [category, script, combining, joining, syllabic, positional];
	let recordIndex = new Map<string, number>();
	let records = new Varints();
	let runs = new Varints();
	let runCount = 0;
	let previous = -1;
	let previousStart = 0;
	for (let codePoint = 0; codePoint < CODE_POINTS; codePoint++) {
		let key = columns.map((column) => column[codePoint]).join(",");
		let index = recordIndex.get(key);
		if (index === undefined) {
			index = recordIndex.size;
			recordIndex.set(key, index);
			for (let column of columns) records.push(column[codePoint] ?? 0);
		}
		if (index === previous) continue;
		runs.push(codePoint - previousStart);
		runs.push(index);
		runCount++;
		previous = index;
		previousStart = codePoint;
	}

	let mirrors = new Varints();
	let mirrorCount = 0;
	let lastMirror = 0;
	for (let line of readLines(directory, "BidiMirroring.txt")) {
		let target = Number.parseInt(line.fields[0] ?? "", 16);
		mirrors.push(line.first - lastMirror);
		mirrors.push(target);
		lastMirror = line.first;
		mirrorCount++;
	}

	let ignorables = new Varints();
	let ignorableCount = 0;
	let lastIgnorable = 0;
	let ranges = readLines(directory, "DerivedCoreProperties.txt").filter(
		(line) => line.fields[0] === "Default_Ignorable_Code_Point",
	);
	for (let codePoint = 0; codePoint < CODE_POINTS; codePoint++) {
		let inside = ranges.some((line) => line.first <= codePoint && codePoint <= line.last);
		if (!inside || VISIBLE_FILLERS.has(codePoint)) continue;
		let end = codePoint;
		while (ranges.some((line) => line.first <= end + 1 && end + 1 <= line.last)) end++;
		ignorables.push(codePoint - lastIgnorable);
		ignorables.push(end - codePoint);
		lastIgnorable = codePoint;
		ignorableCount++;
		codePoint = end;
	}

	let list = (values: string[]) => JSON.stringify(values);
	let source = `/**
 * Unicode ${version} character properties for shaping, generated by
 * \`packages/font/scripts/generate-unicode.ts\` from the Unicode Character Database; rerun it on
 * each Unicode release instead of editing this file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The Unicode Character Database version these tables were generated from. */
export const UNICODE_VERSION = "${version}";

/** General category short names (\`Lu\`, \`Mn\`); a record's first field indexes it. */
export const GENERAL_CATEGORIES: readonly string[] = ${list(categories)};

/** ISO 15924 script codes (\`Latn\`, \`Arab\`); a record's second field indexes it. */
export const SCRIPTS: readonly string[] = ${list(scripts)};

/** Canonical combining classes; a record's third field indexes it. */
export const COMBINING_CLASSES: readonly number[] = [${classes.join(",")}];

/** Joining types (\`U\`, \`D\`), with the Syriac groups \`ALAPH\` and \`DALATH_RISH\`; the fourth field. */
export const JOINING_TYPES: readonly string[] = ${list(joinings)};

/** Indic syllabic categories (\`Consonant\`, \`Virama\`); the fifth field. */
export const INDIC_SYLLABIC_CATEGORIES: readonly string[] = ${list(syllabics)};

/** Indic positional categories (\`Left\`, \`Top\`); the sixth field. */
export const INDIC_POSITIONAL_CATEGORIES: readonly string[] = ${list(positionals)};

/** How many fields each record holds. */
export const RECORD_FIELDS = ${columns.length};

/** ${recordIndex.size} records of ${columns.length} LEB128 indices each, base64. */
export const RECORDS = "${records.toBase64()}";

/** ${runCount} runs as LEB128 pairs (distance from the previous run's start, record), base64. */
export const RUNS = "${runs.toBase64()}";

/** ${mirrorCount} Bidi_Mirroring_Glyph pairs as LEB128 (distance from the previous code point, mirror), base64. */
export const MIRRORS = "${mirrors.toBase64()}";

/** ${ignorableCount} default ignorable ranges as LEB128 (distance from the previous start, length - 1), base64. */
export const DEFAULT_IGNORABLES = "${ignorables.toBase64()}";
`;
	writeFileSync(OUTPUT, source);
	execFileSync("vp", ["fmt", OUTPUT], { stdio: "ignore" });
	process.stdout.write(
		`Unicode ${version}: ${recordIndex.size} records, ${runCount} runs, ${source.length} bytes\n`,
	);
}

main();
