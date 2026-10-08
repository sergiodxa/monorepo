/**
 * Parses and serializes the draft-cavage-12 `Signature` header: comma-separated
 * `name="value"` pairs (`created` and `expires` as bare integers) with no escaping. It
 * predates Structured Fields, so it has its own grammar here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { Base64 } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import type { CavageSignature } from "./types.js";

import { HttpSignatureError } from "./errors.js";

/** One `name=value` pair: the value quoted (no escapes exist) or a bare integer. */
const PAIR_PATTERN = /^\s*([A-Za-z]+)\s*=\s*(?:"([^"]*)"|(\d+))\s*(?:,|$)/;

/** The parameters draft-cavage-12 §2.1 defines; any other is skipped. */
const KNOWN_PARAMETERS = new Set([
	"keyId",
	"algorithm",
	"created",
	"expires",
	"headers",
	"signature",
]);

/**
 * Parses a cavage `Signature` header value, or the part of `Authorization` after
 * `Signature `. Parameters other than the six draft-cavage-12 defines are ignored.
 *
 * @param text - The header value.
 * @returns The fields, or `malformed` for broken syntax, a repeated parameter, a missing
 *   `keyId` or `signature`, a non-integer time, or a signature that is not base64.
 * @example parseCavageSignature('keyId="Test",algorithm="rsa-sha256",signature="…"')
 */
export function parseCavageSignature(text: string): Result<CavageSignature, HttpSignatureError> {
	let values = new Map<string, string>();
	let rest = text.trim();

	while (rest.length > 0) {
		let match = PAIR_PATTERN.exec(rest);
		if (match === null) return failure(malformed("Malformed Signature"));

		let [whole, name = "", quoted, bare] = match;
		if (values.has(name)) return failure(malformed(`Signature repeats ${name}`));
		if (KNOWN_PARAMETERS.has(name)) values.set(name, quoted ?? bare ?? "");
		rest = rest.slice(whole.length);
	}

	let keyId = values.get("keyId");
	let signatureText = values.get("signature");
	if (keyId === undefined || keyId === "") return failure(malformed("Signature has no keyId"));
	if (signatureText === undefined) return failure(malformed("Signature has no signature"));

	let signature = Base64.decode(signatureText.replaceAll(/\s/g, ""));
	if (isFailure(signature)) return failure(malformed("Signature signature is not base64"));

	let created = readTime(values.get("created"), "created");
	if (isFailure(created)) return created;
	let expires = readTime(values.get("expires"), "expires");
	if (isFailure(expires)) return expires;

	let headers = values.get("headers");
	return success({
		keyId,
		algorithm: values.get("algorithm") ?? null,
		created: created.data,
		expires: expires.data,
		headers: headers === undefined ? null : headers.toLowerCase().split(/\s+/).filter(Boolean),
		signature: signature.data,
	});
}

/**
 * Serializes a cavage `Signature` header value in the order Mastodon writes it, `created`
 * and `expires` as bare integers after `algorithm`.
 *
 * @param signature - The fields.
 * @returns The header value, or `malformed` for a `keyId`, `algorithm` or header name
 *   holding a double quote, which the grammar cannot carry.
 * @example stringifyCavageSignature({ keyId, algorithm: "hs2019", created: null, expires: null, headers: ["date"], signature })
 */
export function stringifyCavageSignature(
	signature: CavageSignature,
): Result<string, HttpSignatureError> {
	let quoted = [signature.keyId, signature.algorithm ?? "", ...(signature.headers ?? [])];
	if (quoted.some((value) => value.includes('"'))) {
		return failure(malformed("A Signature value holds a double quote"));
	}

	let pairs = [`keyId="${signature.keyId}"`];
	if (signature.algorithm !== null) pairs.push(`algorithm="${signature.algorithm}"`);
	if (signature.created !== null) pairs.push(`created=${toSeconds(signature.created)}`);
	if (signature.expires !== null) pairs.push(`expires=${toSeconds(signature.expires)}`);
	if (signature.headers !== null) pairs.push(`headers="${signature.headers.join(" ")}"`);
	pairs.push(`signature="${Base64.encode(signature.signature)}"`);
	return success(pairs.join(","));
}

/**
 * Reads `created` or `expires`, which must be whole UNIX seconds.
 *
 * @param value - The parameter text, if present.
 * @param name - The parameter name, for the message.
 */
function readTime(
	value: string | undefined,
	name: string,
): Result<Date | null, HttpSignatureError> {
	if (value === undefined) return success(null);
	if (!/^\d+$/.test(value)) return failure(malformed(`Signature ${name} is not an integer`));
	return success(new Date(Number(value) * 1000));
}

/**
 * Whole UNIX seconds of a time.
 *
 * @param date - The time.
 */
function toSeconds(date: Date): number {
	return Math.floor(date.getTime() / 1000);
}

/**
 * A `malformed` failure.
 *
 * @param message - What is wrong.
 */
function malformed(message: string): HttpSignatureError {
	return new HttpSignatureError("malformed", message);
}
