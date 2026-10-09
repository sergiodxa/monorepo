/**
 * PEM armor (RFC 7468) for DER key material: the text form SPKI public keys and PKCS#8
 * private keys travel in, from ActivityPub `publicKeyPem` to keys pasted into a secret.
 * Decoding checks the label, so a private key never imports where a public key belongs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { BinaryLike, Bytes } from "./lib/bytes.js";

import { Base64 } from "./encoding.js";
import { InvalidEncodingError } from "./errors.js";
import { toBytes } from "./lib/bytes.js";

/** Base64 characters per body line, the width RFC 7468 §2 has generators write. */
const LINE_WIDTH = 64;

/** Labels are printable ASCII without `-`, separated by single spaces or hyphens (RFC 7468 §3). */
const LABEL_PATTERN = /^(?:[!-,.-~](?:[- ]?[!-,.-~])*)?$/;

/** The dashes that open and close each armor line. */
const DASHES = "-----";

/** The opening of a begin line, up to where its label starts. */
const BEGIN_MARKER = `${DASHES}BEGIN `;

/** The opening of an end line, up to where its label starts. */
const END_MARKER = `${DASHES}END `;

/** The labels and body of the first PEM block in a text. */
interface Armor {
	begin: string;
	body: string;
	end: string;
}

/**
 * Where the dashes closing a label sit, scanning from `from` to the end of that line.
 *
 * @param text Text holding the armor line.
 * @param from Index where the label starts.
 * @returns The index of the closing dashes, or `-1` when the line ends first.
 */
function closingDashes(text: string, from: number): number {
	for (let index = from; index < text.length; index++) {
		if (text.startsWith(DASHES, index)) return index;
		let char = text[index];
		if (char === "\r" || char === "\n") return -1;
	}
	return -1;
}

/**
 * The first block whose begin and end lines are both closed: text before it is explanatory
 * text a parser skips. Each character is scanned a bounded number of times, so hostile input
 * such as thousands of unterminated begin lines costs linear time.
 *
 * @param text Text holding a PEM block.
 * @returns The block's labels and raw body, or `null` when the text holds no block.
 */
function findArmor(text: string): Armor | null {
	let from = 0;
	while (true) {
		let begin = text.indexOf(BEGIN_MARKER, from);
		if (begin === -1) return null;

		let labelStart = begin + BEGIN_MARKER.length;
		let labelEnd = closingDashes(text, labelStart);
		if (labelEnd === -1) {
			from = begin + 1;
			continue;
		}

		let bodyStart = labelEnd + DASHES.length;
		let search = bodyStart;
		while (true) {
			let end = text.indexOf(END_MARKER, search);
			if (end === -1) return null;

			let endLabelStart = end + END_MARKER.length;
			let endLabelEnd = closingDashes(text, endLabelStart);
			if (endLabelEnd !== -1) {
				return {
					begin: text.slice(labelStart, labelEnd),
					body: text.slice(bodyStart, end),
					end: text.slice(endLabelStart, endLabelEnd),
				};
			}
			search = end + 1;
		}
	}
}

/**
 * PEM text for DER bytes: `-----BEGIN <label>-----`, base64 wrapped at 64 columns, and
 * the matching end line. Labels name the structure inside, such as `PUBLIC KEY` for SPKI
 * and `PRIVATE KEY` for PKCS#8.
 *
 * @example
 * Pem.encode(spki, "PUBLIC KEY"); // "-----BEGIN PUBLIC KEY-----\nMIIBIjAN…\n-----END PUBLIC KEY-----\n"
 */
export class Pem {
	/**
	 * Armors DER bytes under a label, with `\n` line endings and a trailing newline.
	 *
	 * @param der The DER encoding, such as `crypto.subtle.exportKey("spki", key)`'s result.
	 * @param label The structure name, such as `PUBLIC KEY` or `PRIVATE KEY`.
	 * @returns The PEM text, or `InvalidEncodingError` for a label RFC 7468 does not allow.
	 * @example
	 * Pem.encode(await crypto.subtle.exportKey("spki", publicKey), "PUBLIC KEY");
	 */
	static encode(der: BinaryLike, label: string): Result<string, InvalidEncodingError> {
		if (!LABEL_PATTERN.test(label)) return failure(new InvalidEncodingError("PEM label"));

		let body = Base64.encode(toBytes(der));
		let lines: string[] = [];
		for (let offset = 0; offset < body.length; offset += LINE_WIDTH) {
			lines.push(body.slice(offset, offset + LINE_WIDTH));
		}

		return success(`-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`);
	}

	/**
	 * Reads the first PEM block in a text and answers its DER bytes once its label matches.
	 *
	 * Explanatory text around the block, CRLF line endings, indentation and any line width
	 * are accepted; the base64 body itself must be canonical and padded.
	 *
	 * @param text Text holding a PEM block.
	 * @param label The label the block must carry, such as `PUBLIC KEY`.
	 * @returns The DER bytes, or `InvalidEncodingError` for a missing block, a label other
	 *   than `label`, mismatched begin and end lines, or an empty or non-base64 body.
	 * @example
	 * Pem.decode(actor.publicKey.publicKeyPem, "PUBLIC KEY"); // success(spki bytes)
	 */
	static decode(text: string, label: string): Result<Bytes, InvalidEncodingError> {
		let armor = findArmor(text);
		if (armor === null) return failure(new InvalidEncodingError("PEM"));

		let { begin, body, end } = armor;
		if (begin !== label || end !== label) {
			return failure(new InvalidEncodingError(`PEM ${label}`));
		}

		let decoded = Base64.decode(body.replaceAll(/\s/g, ""));
		if (isFailure(decoded) || decoded.data.length === 0) {
			return failure(new InvalidEncodingError("PEM"));
		}
		return decoded;
	}
}
