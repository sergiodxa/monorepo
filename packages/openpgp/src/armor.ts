/**
 * ASCII armor (RFC 9580 §6): base64 between `-----BEGIN PGP …-----` lines, with the
 * optional CRC24 footer written only on request and never held against a reader, as
 * §6.1 requires, so keys and signatures travel through text channels unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { Base64 } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import { OpenPgpError } from "./errors.js";

/** What an armored block holds, named after its header line (RFC 9580 Table 16). */
export type ArmorType = "message" | "public-key" | "private-key" | "signature";

/** The header line text of each armor type. */
const LABELS: Record<ArmorType, string> = {
	message: "PGP MESSAGE",
	"public-key": "PGP PUBLIC KEY BLOCK",
	"private-key": "PGP PRIVATE KEY BLOCK",
	signature: "PGP SIGNATURE",
};

/** An armor header or tail line, capturing whether it begins or ends and its label. */
const ARMOR_LINE = /^-----(BEGIN|END) (PGP [A-Z ,/0-9]+)-----\s*$/;

/** An armor header: a key, a colon and a single space, then the value (§6.2.2). */
const HEADER_LINE = /^([^\s:]+): (.*)$/;

/** The CRC24 footer: `=` then four base64 characters. */
const CHECKSUM_LINE = /^=([A-Za-z0-9+/]{4})$/;

/** The base64 line width written; §6 caps it at 76. */
const LINE_WIDTH = 64;

/** An armored block, decoded. */
export interface Armored {
	type: ArmorType;
	/** Armor headers in order, as `[key, value]` pairs; none of them is signed. */
	headers: Array<[string, string]>;
	data: Bytes;
	/**
	 * What the CRC24 footer said: `missing` and `mismatch` are reported, never refused,
	 * because RFC 9580 §6.1 forbids rejecting an object over its checksum.
	 */
	checksum: "valid" | "missing" | "mismatch";
}

/** How a block is armored. */
export interface ArmorOptions {
	/** Armor headers to write; RFC 9580 discourages `Version`. */
	headers?: Array<[string, string]>;
	/**
	 * Writes the CRC24 footer, which RFC 9580 §6.1 reserves for readers that require it
	 * and forbids for version 6 keys and signatures.
	 *
	 * @default false
	 */
	checksum?: boolean;
}

/**
 * The CRC24 (RFC 9580 §6.1) over the octets, generator 0x864CFB, initial value 0xB704CE.
 *
 * @param data - The octets the footer covers, before base64.
 * @example
 * crc24(new Uint8Array()); // 0xb704ce
 */
export function crc24(data: Uint8Array): number {
	let crc = 0xb704ce;
	for (let byte of data) {
		crc ^= byte << 16;
		for (let bit = 0; bit < 8; bit++) {
			crc <<= 1;
			if (crc & 0x1000000) crc = (crc & 0xffffff) ^ 0x864cfb;
		}
	}
	return crc & 0xffffff;
}

/**
 * The CRC24 footer line for the octets.
 *
 * @param data - The armored octets.
 */
function checksumLine(data: Uint8Array): string {
	let crc = crc24(data);
	return `=${Base64.encode(Uint8Array.of((crc >> 16) & 0xff, (crc >> 8) & 0xff, crc & 0xff))}`;
}

/**
 * Armors binary OpenPGP data: header line, armor headers, a blank line, base64 in
 * 64-character lines, the CRC24 footer only when asked, and the tail line. Lines end
 * in LF and the text ends with a newline.
 *
 * @param type - What the data is.
 * @param data - The packets to armor.
 * @param options - Armor headers and whether to write the CRC24 footer.
 * @example
 * armor("signature", signaturePackets);
 */
export function armor(type: ArmorType, data: Uint8Array, options: ArmorOptions = {}): string {
	let label = LABELS[type];
	let lines = [`-----BEGIN ${label}-----`];
	for (let [key, value] of options.headers ?? []) lines.push(`${key}: ${value}`);
	lines.push("");

	let encoded = Base64.encode(data);
	for (let start = 0; start < encoded.length; start += LINE_WIDTH) {
		lines.push(encoded.slice(start, start + LINE_WIDTH));
	}
	if (options.checksum) lines.push(checksumLine(data));
	lines.push(`-----END ${label}-----`);
	return `${lines.join("\n")}\n`;
}

/**
 * The armor type a header label names, or `undefined` for a label this package does not
 * read (such as a multi-part `PGP MESSAGE, PART 1/2`).
 *
 * @param label - The text between the dashes, after `BEGIN `.
 */
function typeOf(label: string): ArmorType | undefined {
	return (Object.keys(LABELS) as ArmorType[]).find((type) => LABELS[type] === label);
}

/** The lines of one armored block: its type, headers, base64 body lines and footer. */
interface ArmorLines {
	type: ArmorType;
	headers: Array<[string, string]>;
	body: string[];
	footer: string | null;
}

/**
 * Splits the first armored block in the text into its parts. Text before the header
 * line is skipped; a header that is not `Key: Value` ends the headers early so a block
 * missing its blank line still decodes.
 *
 * @param lines - The text's lines.
 */
function splitBlock(lines: string[]): Result<ArmorLines, OpenPgpError> {
	let start = lines.findIndex((line) => ARMOR_LINE.exec(line)?.[1] === "BEGIN");
	let begin = ARMOR_LINE.exec(lines[start] ?? "");
	if (start === -1 || !begin)
		return failure(new OpenPgpError("malformed", "No armor header line."));

	let label = begin[2] ?? "";
	let type = typeOf(label);
	if (type === undefined) {
		return failure(new OpenPgpError("unsupported", `Armor of type "${label}" is not supported.`));
	}

	let headers: Array<[string, string]> = [];
	let index = start + 1;
	for (; index < lines.length; index++) {
		let line = lines[index] ?? "";
		if (line.trim() === "") {
			index++;
			break;
		}
		let header = HEADER_LINE.exec(line);
		if (!header) break;
		headers.push([header[1] ?? "", header[2] ?? ""]);
	}

	let body: string[] = [];
	let footer: string | null = null;
	for (; index < lines.length; index++) {
		let line = (lines[index] ?? "").trim();
		let tail = ARMOR_LINE.exec(line);
		if (tail) {
			if (tail[1] !== "END" || tail[2] !== label) break;
			return success({ type, headers, body, footer });
		}
		let checksum = CHECKSUM_LINE.exec(line);
		if (checksum) footer = checksum[1] ?? null;
		else body.push(line);
	}
	return failure(new OpenPgpError("malformed", `The armor has no "-----END ${label}-----" line.`));
}

/**
 * Decodes the first armored block in the text. Whitespace inside the base64 is ignored,
 * and the CRC24 footer is checked and reported but never fails the decode.
 *
 * @param text - Text holding an armored block, possibly with other text around it.
 * @example
 * let block = dearmor(armoredKey);
 * if (isSuccess(block)) block.data.type; // "public-key"
 */
export function dearmor(text: string): Result<Armored, OpenPgpError> {
	let block = splitBlock(text.split(/\r?\n/));
	if (isFailure(block)) return block;

	let { type, headers, body, footer } = block.data;
	let data = Base64.decode(body.join("").replace(/\s+/g, ""));
	if (isFailure(data)) {
		return failure(
			new OpenPgpError("malformed", "The armor body is not base64.", { cause: data.error }),
		);
	}

	let checksum: Armored["checksum"] = "missing";
	if (footer !== null) checksum = checksumLine(data.data) === `=${footer}` ? "valid" : "mismatch";
	return success({ type, headers, data: data.data, checksum });
}
