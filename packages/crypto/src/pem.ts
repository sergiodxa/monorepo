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

/** The armor around a body: any text before it is explanatory text a parser skips. */
const ARMOR_PATTERN = /-----BEGIN ([^\r\n]*?)-----([\s\S]*?)-----END ([^\r\n]*?)-----/;

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
		let match = ARMOR_PATTERN.exec(text);
		if (match === null) return failure(new InvalidEncodingError("PEM"));

		let [, begin = "", body = "", end = ""] = match;
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
