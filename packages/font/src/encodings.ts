/**
 * Decodes the text encodings `name` records use and maps Unicode onto the legacy single-byte
 * encodings old `cmap` subtables are keyed by. Each record names its encoding by platform,
 * encoding and language IDs; this module turns those IDs into an encoding and its language tag.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MAC_LANGUAGES, SINGLE_BYTE_ENCODINGS, WINDOWS_LANGUAGES } from "./encodings.data.js";

/** Encodings by Macintosh script ID, the `encodingID` of platform 1; gaps have no decoder. */
const MAC_SCRIPTS: ReadonlyMap<number, string> = new Map([
	[0, "x-mac-roman"],
	[1, "shift-jis"],
	[2, "big5"],
	[3, "euc-kr"],
	[4, "iso-8859-6"],
	[5, "iso-8859-8"],
	[6, "x-mac-greek"],
	[7, "x-mac-cyrillic"],
	[21, "iso-8859-11"],
	[25, "gbk"],
	[29, "x-mac-ce"],
]);

/** Macintosh language IDs whose script uses a regional variant of the Roman encoding. */
const MAC_LANGUAGE_ENCODINGS: ReadonlyMap<number, string> = new Map([
	[15, "x-mac-icelandic"],
	[17, "x-mac-turkish"],
	[18, "x-mac-croatian"],
	[24, "x-mac-ce"],
	[25, "x-mac-ce"],
	[26, "x-mac-ce"],
	[27, "x-mac-ce"],
	[28, "x-mac-ce"],
	[30, "x-mac-icelandic"],
	[37, "x-mac-romanian"],
	[38, "x-mac-ce"],
	[39, "x-mac-ce"],
	[40, "x-mac-ce"],
	[143, "x-mac-inuit"],
	[146, "x-mac-gaelic"],
]);

/** Encodings by Windows encoding ID; symbol fonts (`0`) store UTF-16BE like Unicode ones. */
const WINDOWS_ENCODINGS: ReadonlyMap<number, string> = new Map([
	[0, "utf-16be"],
	[1, "utf-16be"],
	[2, "shift-jis"],
	[3, "gb18030"],
	[4, "big5"],
	[5, "euc-kr"],
	[10, "utf-16be"],
]);

/** Unicode-to-byte tables for the single-byte encodings, built on first use. */
const ENCODERS = new Map<string, ReadonlyMap<number, number>>();

/** Decoders for the multi-byte encodings, `null` where the runtime's `TextDecoder` lacks one. */
const DECODERS = new Map<string, TextDecoder | null>();

/**
 * The encoding of a `name` record or `cmap` subtable.
 *
 * @param platform - Platform ID: 0 Unicode, 1 Macintosh, 2 ISO, 3 Windows.
 * @param encoding - The platform-specific encoding ID.
 * @param language - The platform-specific language ID; Macintosh languages pick regional
 *   variants of the Roman script.
 * @returns An encoding label, or `null` for one this package cannot read.
 */
export function encodingOf(platform: number, encoding: number, language: number): string | null {
	if (platform === 0) return "utf-16be";
	if (platform === 1)
		return MAC_LANGUAGE_ENCODINGS.get(language) ?? MAC_SCRIPTS.get(encoding) ?? null;
	if (platform === 2) {
		if (encoding === 0 || encoding === 2) return "iso-8859-1";
		return encoding === 1 ? "utf-16be" : null;
	}
	if (platform === 3) return WINDOWS_ENCODINGS.get(encoding) ?? null;
	return null;
}

/**
 * Decodes bytes in an encoding from `encodingOf`. UTF-16BE, Latin-1 and the single-byte Mac
 * and ISO encodings decode everywhere; the CJK encodings decode where the runtime's
 * `TextDecoder` supports them.
 *
 * @param bytes - The encoded text.
 * @param encoding - An encoding label.
 * @returns The text, or `null` when no decoder for the encoding is available.
 */
export function decodeText(bytes: Uint8Array, encoding: string): string | null {
	if (encoding === "utf-16be") {
		let units: number[] = [];
		for (let index = 0; index + 1 < bytes.length; index += 2) {
			units.push(((bytes[index] ?? 0) << 8) | (bytes[index + 1] ?? 0));
		}
		return fromCharCodes(units);
	}
	if (encoding === "iso-8859-1") return fromCharCodes(Array.from(bytes));
	let table = SINGLE_BYTE_ENCODINGS[encoding];
	if (table !== undefined) {
		let text = "";
		for (let byte of bytes) text += byte < 0x80 ? String.fromCharCode(byte) : table[byte - 0x80];
		return text;
	}
	let decoder = decoderFor(encoding);
	return decoder === null ? null : decoder.decode(bytes);
}

/**
 * How a single-byte encoding stores each Unicode character above ASCII, the reverse of its
 * table. Characters the encoding cannot store are absent.
 *
 * @param encoding - An encoding label.
 * @returns The table, or `null` for an encoding that is not single-byte.
 */
export function legacyEncoder(encoding: string): ReadonlyMap<number, number> | null {
	let cached = ENCODERS.get(encoding);
	if (cached !== undefined) return cached;
	let table = SINGLE_BYTE_ENCODINGS[encoding];
	if (table === undefined) return null;
	let encoder = new Map<number, number>();
	for (let index = 0; index < table.length; index++) {
		let character = table.charCodeAt(index);
		if (character !== 0xfffd && !encoder.has(character)) encoder.set(character, 0x80 + index);
	}
	ENCODERS.set(encoding, encoder);
	return encoder;
}

/**
 * The Unicode character a byte of a single-byte encoding stands for.
 *
 * @param encoding - A label `legacyEncoder` accepts.
 * @param byte - A byte, `0x00`–`0xFF`.
 * @returns The code point, or `null` for a byte the encoding leaves undefined.
 */
export function legacyDecode(encoding: string, byte: number): number | null {
	if (byte < 0x80) return byte;
	let character = SINGLE_BYTE_ENCODINGS[encoding]?.charCodeAt(byte - 0x80);
	return character === undefined || Number.isNaN(character) || character === 0xfffd
		? null
		: character;
}

/**
 * The BCP 47 tag of a `name` record's language. Windows and Macintosh IDs come from their
 * platform's tables, IDs from `0x8000` up index the table's own language tags, and any
 * other ID answers `"<platform>-<id>"` so every record still has a key.
 *
 * @param platform - Platform ID.
 * @param language - The record's language ID.
 * @param tags - Language tags from a version 1 `name` table, in order.
 */
export function languageTag(platform: number, language: number, tags: readonly string[]): string {
	let tag: string | undefined;
	if (platform === 1) tag = MAC_LANGUAGES.get(language);
	else if (platform === 3) tag = WINDOWS_LANGUAGES.get(language);
	if (tag === undefined && language >= 0x8000) tag = tags[language - 0x8000];
	return tag ?? `${platform}-${language}`;
}

/**
 * A cached `TextDecoder`, `null` when the runtime does not know the encoding.
 *
 * @param encoding - A WHATWG encoding label.
 */
function decoderFor(encoding: string): TextDecoder | null {
	let cached = DECODERS.get(encoding);
	if (cached !== undefined) return cached;
	let decoder: TextDecoder | null = null;
	try {
		decoder = new TextDecoder(encoding);
	} catch {
		decoder = null;
	}
	DECODERS.set(encoding, decoder);
	return decoder;
}

/**
 * Joins UTF-16 code units in chunks, which keeps long strings under the engine's argument limit.
 *
 * @param units - UTF-16 code units.
 */
function fromCharCodes(units: readonly number[]): string {
	let text = "";
	for (let start = 0; start < units.length; start += 4096) {
		text += String.fromCharCode(...units.slice(start, start + 4096));
	}
	return text;
}
