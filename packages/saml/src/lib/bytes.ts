/**
 * The byte readers the XML side needs: base64 as a signed document actually
 * writes it, wrapped across lines and indented, which the strict decoder every
 * other caller wants would reject.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { Base64 } from "@sdxc/crypto";
import { failure } from "@sdxc/result";

import { MalformedDocumentError } from "../errors.js";

/** Whitespace a signer's line wrapping leaves inside a base64 element. */
const WHITESPACE_PATTERN = /\s+/g;

/**
 * Reads the base64 inside an element, ignoring the line wrapping signers apply
 * to it, which the canonical decoder treats as part of the alphabet and refuses.
 *
 * @param text - Element text, as written
 * @param field - Fixed name of the element, for the failure
 * @returns The decoded bytes, or a malformed-document failure
 */
export function decodeBase64Text(
	text: string,
	field: string,
): Result<Bytes, MalformedDocumentError> {
	let decoded = Base64.decode(text.replaceAll(WHITESPACE_PATTERN, ""));
	if (decoded.status === "failure") {
		return failure(new MalformedDocumentError(`${field} is not base64`));
	}
	return decoded;
}

/**
 * Copies bytes into a buffer Web Crypto accepts. A view over a growable or
 * shared buffer is refused at the call, so every byte string reaching a crypto
 * call passes through here first.
 *
 * @param bytes - Byte view from anywhere
 * @returns The same bytes over a plain buffer
 */
export function toBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
	let copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
	copy.set(bytes);
	return copy;
}
