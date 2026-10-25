/**
 * COSE_Sign1 (RFC 9052 Section 4.2): signing a payload under one key, reading a message,
 * and verifying it with the algorithm its protected header names, embedded or detached.
 * It is the envelope SCITT Signed Statements and Receipts are built on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { CBORValue } from "../values.js";

import { decode } from "../decode.js";
import { encode } from "../encode.js";
import { Tagged } from "../values.js";

import { COSEError, describeValue } from "./errors.js";
import { keyFits, profile } from "./key.js";

/** A COSE header map: integer or text labels to values. */
export type Header = Map<CBORValue, CBORValue>;

/** The CBOR tag that marks a COSE_Sign1 message. */
export const SIGN1_TAG = 18;

/** Protected header labels this module reads itself. */
const ALG = 1;
const CRIT = 2;

/** Nesting a header map may reach; COSE headers sit a few levels deep at most. */
const HEADER_DEPTH = 16;

/** A decoded COSE_Sign1 message. */
export interface Sign1 {
	/** The protected header, decoded. */
	protected: Header;
	/** The protected header exactly as signed; re-encoding a message keeps these bytes. */
	encodedProtected: Uint8Array<ArrayBuffer>;
	/** The unprotected header, which the signature does not cover. */
	unprotected: Header;
	/** The payload, or `null` when it is detached. */
	payload: Uint8Array<ArrayBuffer> | null;
	/** The signature bytes. */
	signature: Uint8Array<ArrayBuffer>;
}

/** What `sign1` signs. */
export interface Sign1Options {
	/** Protected header; it MUST name the algorithm (label 1) the key signs with. */
	protected: Header;
	/** Unprotected header. Default empty. */
	unprotected?: Header;
	/** The bytes to sign. */
	payload: Uint8Array;
	/** Leave the payload out of the message, so a verifier supplies it. Default `false`. */
	detached?: boolean;
	/** Application data bound to the signature without travelling in the message. */
	externalAad?: Uint8Array;
	/** Private key imported for the protected header's algorithm. */
	key: CryptoKey;
}

/** How `verifySign1` checks a message. */
export interface VerifyOptions {
	/** The payload of a message that carries none. */
	payload?: Uint8Array;
	/** Application data the signer bound to the signature. */
	externalAad?: Uint8Array;
	/** Algorithms to accept. Default: whichever one the key was imported for. */
	algorithms?: number[];
	/** Header labels the caller processes, so a `crit` listing only these verifies. */
	understood?: CBORValue[];
}

/**
 * Signs `payload` into a tagged COSE_Sign1 message. The signature covers the protected header,
 * the external AAD and the payload, also when the payload is detached.
 *
 * @returns The message bytes, or `unsupported-algorithm` / `unsupported-key` when the
 * protected header's algorithm and the key disagree.
 * @example
 * let message = await COSE.sign1({ protected: new Map([[1, COSE.Algorithm.ES256]]), payload, key });
 */
export async function sign1(
	options: Sign1Options,
): Promise<Result<Uint8Array<ArrayBuffer>, COSEError>> {
	let algorithm = options.protected.get(ALG);
	let target = profile(algorithm);
	if (!target || typeof algorithm !== "number") {
		return failure(
			new COSEError("unsupported-algorithm", `unsupported algorithm ${describeValue(algorithm)}`),
		);
	}
	if (!keyFits(options.key, algorithm)) {
		return failure(new COSEError("unsupported-key", `key cannot sign with algorithm ${algorithm}`));
	}

	let encodedProtected = encodeHeader(options.protected);
	if (isFailure(encodedProtected)) return encodedProtected;
	let payload = Uint8Array.from(options.payload);
	let toBeSigned = sigStructure(encodedProtected.data, options.externalAad, payload);
	if (isFailure(toBeSigned)) return toBeSigned;

	let signature: Uint8Array<ArrayBuffer>;
	try {
		signature = new Uint8Array(
			await crypto.subtle.sign(target.signParams, options.key, toBeSigned.data),
		);
	} catch {
		return failure(new COSEError("unsupported-key", "key could not sign"));
	}

	return encodeSign1({
		protected: options.protected,
		encodedProtected: encodedProtected.data,
		unprotected: options.unprotected ?? new Map(),
		payload: options.detached ? null : payload,
		signature,
	});
}

/**
 * Reads a COSE_Sign1 message, tagged 18 or untagged, without checking its signature.
 *
 * @returns The message, or `malformed` for bytes that are not one.
 * @example
 * let message = COSE.decodeSign1(bytes); // success({ protected, unprotected, payload, … })
 */
export function decodeSign1(bytes: Uint8Array): Result<Sign1, COSEError> {
	let decoded = decode(bytes, { maxDepth: HEADER_DEPTH + 2 });
	if (isFailure(decoded)) return failure(new COSEError("malformed", decoded.error.message));
	return fromValue(decoded.data);
}

/**
 * A COSE_Sign1 message from an already decoded CBOR value, such as one nested in another
 * structure.
 *
 * @returns The message, or `malformed` for a value that is not one.
 */
export function fromValue(value: CBORValue): Result<Sign1, COSEError> {
	let item = value;
	if (item instanceof Tagged) {
		if (item.tag !== SIGN1_TAG)
			return failure(new COSEError("malformed", `unexpected tag ${item.tag}`));
		item = item.value;
	}
	if (!Array.isArray(item) || item.length !== 4) {
		return failure(new COSEError("malformed", "COSE_Sign1 is not a four-item array"));
	}

	let [encodedProtected, unprotected, payload, signature] = item;
	if (!(encodedProtected instanceof Uint8Array)) {
		return failure(new COSEError("malformed", "protected header is not a byte string"));
	}
	if (!(unprotected instanceof Map)) {
		return failure(new COSEError("malformed", "unprotected header is not a map"));
	}
	if (!(payload instanceof Uint8Array) && payload !== null) {
		return failure(new COSEError("malformed", "payload is neither a byte string nor nil"));
	}
	if (!(signature instanceof Uint8Array)) {
		return failure(new COSEError("malformed", "signature is not a byte string"));
	}

	let header = decodeHeader(encodedProtected);
	if (isFailure(header)) return header;
	return success({ protected: header.data, encodedProtected, unprotected, payload, signature });
}

/**
 * Writes a message back out as a tagged COSE_Sign1, keeping the signed protected header
 * bytes, so a changed unprotected header (an attached receipt) leaves the signature valid.
 *
 * @returns The message bytes, or `malformed` for an unencodable unprotected header.
 */
export function encodeSign1(message: Sign1): Result<Uint8Array<ArrayBuffer>, COSEError> {
	let bytes = encode(
		new Tagged(SIGN1_TAG, [
			message.encodedProtected,
			message.unprotected,
			message.payload,
			message.signature,
		]),
	);
	if (isFailure(bytes)) return failure(new COSEError("malformed", bytes.error.message));
	return success(bytes.data);
}

/**
 * Verifies a COSE_Sign1 message under `key`, with the algorithm its protected header names.
 * The algorithm must sit in the protected header, where the signature covers it, and must
 * match the key's import; every `crit` label must be present and `understood`.
 *
 * @param message Message bytes, or a message `decodeSign1` already read.
 * @param key Public key imported for the message's algorithm.
 * @returns The message, or the reason it does not verify.
 * @example
 * let verified = await COSE.verifySign1(bytes, publicKey);
 * let detached = await COSE.verifySign1(bytes, publicKey, { payload });
 */
export async function verifySign1(
	message: Uint8Array | Sign1,
	key: CryptoKey,
	options: VerifyOptions = {},
): Promise<Result<Sign1, COSEError>> {
	let decoded = message instanceof Uint8Array ? decodeSign1(message) : success(message);
	if (isFailure(decoded)) return decoded;
	let sign1 = decoded.data;

	let algorithm = sign1.protected.get(ALG);
	let target = profile(algorithm);
	if (!target || typeof algorithm !== "number") {
		return failure(
			new COSEError("unsupported-algorithm", `unsupported algorithm ${describeValue(algorithm)}`),
		);
	}
	if (options.algorithms && !options.algorithms.includes(algorithm)) {
		return failure(
			new COSEError("unsupported-algorithm", `algorithm ${algorithm} is not accepted`),
		);
	}
	if (!keyFits(key, algorithm)) {
		return failure(new COSEError("unsupported-key", `key cannot verify algorithm ${algorithm}`));
	}

	let critical = checkCritical(sign1.protected, options.understood ?? []);
	if (isFailure(critical)) return critical;

	let payload = sign1.payload ?? options.payload;
	if (payload === undefined) return failure(new COSEError("malformed", "detached payload missing"));
	if (sign1.payload && options.payload && !sameBytes(sign1.payload, options.payload)) {
		return failure(new COSEError("malformed", "message carries a different payload"));
	}

	let toBeSigned = sigStructure(sign1.encodedProtected, options.externalAad, payload);
	if (isFailure(toBeSigned)) return toBeSigned;
	let valid = false;
	try {
		valid = await crypto.subtle.verify(target.signParams, key, sign1.signature, toBeSigned.data);
	} catch {
		valid = false;
	}
	if (!valid) return failure(new COSEError("invalid-signature", "signature does not verify"));
	return success(sign1);
}

/**
 * Encodes a protected header; an empty one is the zero-length byte string RFC 9052 asks for.
 */
function encodeHeader(header: Header): Result<Uint8Array<ArrayBuffer>, COSEError> {
	if (header.size === 0) return success(new Uint8Array(0));
	let bytes = encode(header);
	if (isFailure(bytes)) return failure(new COSEError("malformed", bytes.error.message));
	return success(bytes.data);
}

/** Decodes a protected header; a zero-length byte string is an empty header. */
function decodeHeader(bytes: Uint8Array): Result<Header, COSEError> {
	if (bytes.length === 0) return success(new Map());
	let header = decode(bytes, { maxDepth: HEADER_DEPTH });
	if (isFailure(header))
		return failure(new COSEError("malformed", `protected header: ${header.error.message}`));
	if (!(header.data instanceof Map))
		return failure(new COSEError("malformed", "protected header is not a map"));
	return success(header.data);
}

/** The Sig_structure for a COSE_Sign1 signature, as RFC 9052 Section 4.4 lays it out. */
function sigStructure(
	encodedProtected: Uint8Array,
	externalAad: Uint8Array | undefined,
	payload: Uint8Array,
): Result<Uint8Array<ArrayBuffer>, COSEError> {
	let bytes = encode([
		"Signature1",
		Uint8Array.from(encodedProtected),
		Uint8Array.from(externalAad ?? []),
		Uint8Array.from(payload),
	]);
	if (isFailure(bytes)) return failure(new COSEError("malformed", bytes.error.message));
	return success(bytes.data);
}

/**
 * Checks the `crit` header: a non-empty array of labels, each present in the protected header
 * and among those the caller understands.
 */
function checkCritical(header: Header, understood: CBORValue[]): Result<void, COSEError> {
	let crit = header.get(CRIT);
	if (crit === undefined) return success(undefined);
	if (!Array.isArray(crit) || crit.length === 0) {
		return failure(new COSEError("malformed", "crit is not a non-empty array"));
	}
	for (let label of crit) {
		if (!header.has(label))
			return failure(new COSEError("malformed", `crit label ${describeValue(label)} is absent`));
		if (!understood.includes(label)) {
			return failure(
				new COSEError("unknown-critical", `crit label ${describeValue(label)} is not understood`),
			);
		}
	}
	return success(undefined);
}

/** Whether two byte strings hold the same bytes. */
function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
	return left.length === right.length && left.every((byte, index) => byte === right[index]);
}
