/**
 * Unicode character properties for shaping, read from the generated tables in
 * `unicode.data.ts`. The tables decode on the first lookup, so importing the shaping entry
 * costs nothing until text is shaped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	COMBINING_CLASSES,
	DEFAULT_IGNORABLES,
	GENERAL_CATEGORIES,
	INDIC_POSITIONAL_CATEGORIES,
	INDIC_SYLLABIC_CATEGORIES,
	JOINING_TYPES,
	MIRRORS,
	RECORD_FIELDS,
	RECORDS,
	RUNS,
	SCRIPTS,
} from "./unicode.data.js";

/** The decoded tables: run starts with their records, and every record's field indices. */
interface Tables {
	starts: Uint32Array;
	runRecords: Uint16Array;
	records: Uint16Array;
	mirrors: Map<number, number>;
	ignorableStarts: Uint32Array;
	ignorableEnds: Uint32Array;
}

/** Each property's position in a record, in the order the generator writes them. */
const FIELDS = {
	category: 0,
	script: 1,
	combining: 2,
	joining: 3,
	syllabic: 4,
	positional: 5,
};

/** Joining type of a character: Unicode's six plus the two Syriac groups the joining machine tells apart. */
export type JoiningType = "U" | "L" | "R" | "D" | "C" | "T" | "ALAPH" | "DALATH_RISH";

/** The tables once decoded; every lookup after the first reads them from here. */
const DECODED: { tables: Tables | null } = { tables: null };

/**
 * Unsigned LEB128 numbers from a base64 string.
 *
 * @param base64 - The packed numbers.
 */
function decodeVarints(base64: string): number[] {
	let binary = atob(base64);
	let values: number[] = [];
	let value = 0;
	let scale = 1;
	for (let index = 0; index < binary.length; index++) {
		let byte = binary.charCodeAt(index);
		value += (byte & 0x7f) * scale;
		if (byte < 0x80) {
			values.push(value);
			value = 0;
			scale = 1;
		} else scale *= 0x80;
	}
	return values;
}

/** The decoded tables, built once on the first lookup. */
function load(): Tables {
	if (DECODED.tables !== null) return DECODED.tables;
	let runs = decodeVarints(RUNS);
	let count = runs.length / 2;
	let starts = new Uint32Array(count);
	let runRecords = new Uint16Array(count);
	let start = 0;
	for (let index = 0; index < count; index++) {
		start += runs[index * 2] ?? 0;
		starts[index] = start;
		runRecords[index] = runs[index * 2 + 1] ?? 0;
	}
	let mirrors = new Map<number, number>();
	let pairs = decodeVarints(MIRRORS);
	let codePoint = 0;
	for (let index = 0; index + 1 < pairs.length; index += 2) {
		codePoint += pairs[index] ?? 0;
		mirrors.set(codePoint, pairs[index + 1] ?? 0);
	}
	let ranges = decodeVarints(DEFAULT_IGNORABLES);
	let ignorableStarts = new Uint32Array(ranges.length / 2);
	let ignorableEnds = new Uint32Array(ranges.length / 2);
	let first = 0;
	for (let index = 0; index < ignorableStarts.length; index++) {
		first += ranges[index * 2] ?? 0;
		ignorableStarts[index] = first;
		ignorableEnds[index] = first + (ranges[index * 2 + 1] ?? 0);
	}
	let records = Uint16Array.from(decodeVarints(RECORDS));
	DECODED.tables = { starts, runRecords, records, mirrors, ignorableStarts, ignorableEnds };
	return DECODED.tables;
}

/**
 * One field of a code point's record; code points outside Unicode read as unassigned.
 *
 * @param codePoint - A code point.
 * @param field - The field to read.
 */
function field(codePoint: number, position: number): number {
	let { starts, runRecords, records } = load();
	if (!(codePoint >= 0 && codePoint < 0x110000)) return 0;
	let low = 0;
	let high = starts.length - 1;
	while (low < high) {
		let middle = (low + high + 1) >> 1;
		if ((starts[middle] ?? 0) <= codePoint) low = middle;
		else high = middle - 1;
	}
	return records[(runRecords[low] ?? 0) * RECORD_FIELDS + position] ?? 0;
}

/**
 * The general category's short name (`"Lu"`, `"Mn"`), `"Cn"` for an unassigned code point.
 *
 * @param codePoint - A code point.
 */
export function generalCategory(codePoint: number): string {
	return GENERAL_CATEGORIES[field(codePoint, FIELDS.category)] ?? "Cn";
}

/**
 * The script as an ISO 15924 code (`"Latn"`): `"Zyyy"` for common characters, `"Zinh"` for
 * inherited marks and `"Zzzz"` for unassigned ones.
 *
 * @param codePoint - A code point.
 */
export function script(codePoint: number): string {
	return SCRIPTS[field(codePoint, FIELDS.script)] ?? "Zzzz";
}

/**
 * The canonical combining class, `0` for starters; marks reorder by it before composing.
 *
 * @param codePoint - A code point.
 */
export function combiningClass(codePoint: number): number {
	return COMBINING_CLASSES[field(codePoint, FIELDS.combining)] ?? 0;
}

/**
 * How a character joins its neighbours in a cursive script; marks and format characters
 * outside the Arabic tables are transparent (`"T"`), everything else non-joining (`"U"`).
 *
 * @param codePoint - A code point.
 */
export function joiningType(codePoint: number): JoiningType {
	return (JOINING_TYPES[field(codePoint, FIELDS.joining)] ?? "U") as JoiningType;
}

/**
 * The Indic syllabic category (`"Consonant"`, `"Vowel_Dependent"`), `"Other"` by default.
 *
 * @param codePoint - A code point.
 */
export function indicSyllabicCategory(codePoint: number): string {
	return INDIC_SYLLABIC_CATEGORIES[field(codePoint, FIELDS.syllabic)] ?? "Other";
}

/**
 * The Indic positional category (`"Left"`, `"Top_And_Right"`), `"NA"` by default.
 *
 * @param codePoint - A code point.
 */
export function indicPositionalCategory(codePoint: number): string {
	return INDIC_POSITIONAL_CATEGORIES[field(codePoint, FIELDS.positional)] ?? "NA";
}

/**
 * The character a right-to-left run draws in place of this one (`(` for `)`), or `null`
 * when the character has no mirrored counterpart.
 *
 * @param codePoint - A code point.
 */
export function mirror(codePoint: number): number | null {
	return load().mirrors.get(codePoint) ?? null;
}

/**
 * Whether the character is invisible unless the font substitutes it: soft hyphen, joiners,
 * variation selectors, bidi controls. Hangul fillers count as visible.
 *
 * @param codePoint - A code point.
 */
export function isDefaultIgnorable(codePoint: number): boolean {
	let { ignorableStarts, ignorableEnds } = load();
	for (let index = 0; index < ignorableStarts.length; index++) {
		if (codePoint < (ignorableStarts[index] ?? 0)) return false;
		if (codePoint <= (ignorableEnds[index] ?? 0)) return true;
	}
	return false;
}

/**
 * Whether the general category is a mark (`Mn`, `Mc` or `Me`).
 *
 * @param codePoint - A code point.
 */
export function isMark(codePoint: number): boolean {
	let category = generalCategory(codePoint);
	return category === "Mn" || category === "Mc" || category === "Me";
}

/**
 * Whether the character is a decimal digit (`Nd`), which fraction shaping spans.
 *
 * @param codePoint - A code point.
 */
export function isDigit(codePoint: number): boolean {
	return generalCategory(codePoint) === "Nd";
}
