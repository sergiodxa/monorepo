/**
 * Reads a font's `name` table into every record by name ID and language tag, and picks one
 * language for a name when a caller asks. Records decode once, when the font opens, since
 * the family, style and PostScript names come from here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font, TableRecord } from "./font.js";
import type { Reader } from "./reader.js";

import { decodeText, encodingOf, languageTag } from "./encodings.js";

/** The language a name falls back to when the requested one is missing. */
const DEFAULT_LANGUAGE = "en";

/**
 * Decodes every record of a `name` table. Records are keyed by BCP 47 language tag; when two
 * records share a name ID and tag, the later one wins, which prefers Windows records over
 * Macintosh ones. Records in an encoding without a decoder, or outside the table, are skipped.
 *
 * @param reader - The font bytes.
 * @param table - The `name` table, when the font has one.
 * @returns Names by ID, then language tag.
 */
export function readNames(reader: Reader, table: TableRecord | undefined): Font.Names {
	let names: Record<number, Record<string, string>> = {};
	if (table === undefined || table.length < 6) return names;
	let { offset, length } = table;
	let count = reader.u16(offset + 2);
	let storage = offset + reader.u16(offset + 4);
	let end = offset + length;
	if (offset + 6 + count * 12 > end) return names;

	let tags: string[] = [];
	if (reader.u16(offset) === 1) {
		let tagCount = reader.u16(offset + 6 + count * 12);
		for (let index = 0; index < tagCount; index++) {
			let record = offset + 8 + count * 12 + index * 4;
			if (record + 4 > end) break;
			let start = storage + reader.u16(record + 2);
			let size = reader.u16(record);
			let bytes = start + size <= end ? reader.bytes(start, size) : new Uint8Array(0);
			tags.push(decodeText(bytes, "utf-16be") ?? "");
		}
	}

	for (let index = 0; index < count; index++) {
		let record = offset + 6 + index * 12;
		let platform = reader.u16(record);
		let language = reader.u16(record + 4);
		let size = reader.u16(record + 8);
		let start = storage + reader.u16(record + 10);
		if (start + size > end) continue;
		let encoding = encodingOf(platform, reader.u16(record + 2), language);
		let text = encoding === null ? null : decodeText(reader.bytes(start, size), encoding);
		if (text === null) continue;
		let nameId = reader.u16(record + 6);
		let byLanguage = (names[nameId] ??= {});
		byLanguage[languageTag(platform, language, tags)] = text;
	}
	return names;
}

/**
 * One name in the best available language: the requested tag, then a regional tag of the
 * same language (`ar-SA` for `ar`), then English the same way, then whichever language the
 * font lists first.
 *
 * @param names - From `readNames`.
 * @param nameId - The name ID (`1` family, `4` full name, `6` PostScript name …).
 * @param language - A BCP 47 tag, English when omitted.
 * @returns The name, or `null` when the font records none with that ID.
 */
export function pickName(
	names: Font.Names,
	nameId: number,
	language: string = DEFAULT_LANGUAGE,
): string | null {
	let byLanguage = names[nameId];
	if (byLanguage === undefined) return null;
	return (
		matchLanguage(byLanguage, language) ??
		matchLanguage(byLanguage, DEFAULT_LANGUAGE) ??
		Object.values(byLanguage)[0] ??
		null
	);
}

/**
 * A record for a language: its exact tag, or the first regional tag sharing its subtags.
 *
 * @param byLanguage - Records of one name ID.
 * @param language - A BCP 47 tag.
 */
function matchLanguage(byLanguage: Record<string, string>, language: string): string | null {
	let exact = byLanguage[language];
	if (exact !== undefined) return exact;
	let prefix = `${language.toLowerCase()}-`;
	for (let [tag, text] of Object.entries(byLanguage)) {
		if (tag.toLowerCase().startsWith(prefix)) return text;
	}
	return null;
}
