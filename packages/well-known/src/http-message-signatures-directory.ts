/**
 * The HTTP Message Signatures Directory of Web Bot Auth: the JWK Set an automated client
 * publishes at `/.well-known/http-message-signatures-directory` so any origin can verify
 * the requests it signs, each key labelled with its RFC 7638 thumbprint as `kid`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { WellKnownFormat } from "./format.js";
import type { Jwk } from "./jwks.js";

import { parse as parseJwks } from "./jwks.js";
import { pointer } from "./lib/json.js";
import { WellKnownParseError } from "./parse-error.js";

export const NAME = "http-message-signatures-directory";
export const MEDIA_TYPE = "application/http-message-signatures-directory+json";

/** A directory key: a public JWK, optionally bounded by `nbf` and `exp` in epoch seconds. */
export interface DirectoryKey extends Jwk {
	nbf?: number;
	exp?: number;
}

export interface SignaturesDirectory {
	keys: DirectoryKey[];
}

export interface ParsedSignaturesDirectory extends SignaturesDirectory {
	/**
	 * Entries dropped: unusable as a JWK, symmetric, carrying private members, declaring an
	 * `alg` outside the HTTP Signature Algorithms registry, or with a non-numeric `nbf`/`exp`.
	 */
	skipped: number;
}

/** The asymmetric algorithms the HTTP Signature Algorithms registry (RFC 9421 §6.2) lists. */
const SIGNATURE_ALGORITHMS = new Set([
	"rsa-pss-sha512",
	"rsa-v1_5-sha256",
	"ecdsa-p256-sha256",
	"ecdsa-p384-sha384",
	"ed25519",
]);

/** Members that carry private or symmetric key material (RFC 7518 §6). */
const PRIVATE_MEMBERS = ["d", "p", "q", "dp", "dq", "qi", "oth", "k"] as const;

/**
 * Whether a usable JWK may stand in a directory: asymmetric and public, since the draft
 * forbids shared secrets, with a registered `alg` when it names one.
 *
 * @param key - An entry the JWK Set reader kept.
 */
function isDirectoryKey(key: Jwk): key is DirectoryKey {
	if (key.kty === "oct") return false;
	if (PRIVATE_MEMBERS.some((member) => member in key)) return false;
	if (key.alg !== undefined && !SIGNATURE_ALGORITHMS.has(key.alg)) return false;
	let { nbf, exp } = key as { nbf?: unknown; exp?: unknown };
	return [nbf, exp].every((bound) => bound === undefined || typeof bound === "number");
}

/**
 * A key without its private members and `key_ops`, which a published key never needs, or
 * `null` for a symmetric key, which has no public half.
 *
 * @param key - A key, public or private.
 */
function publicHalf(key: DirectoryKey): DirectoryKey | null {
	if (key.kty === "oct") return null;
	let half: DirectoryKey = { ...key };
	for (let member of PRIVATE_MEMBERS) delete half[member];
	delete half.key_ops;
	return half;
}

/**
 * Reads a directory. A missing or non-array `keys` fails; every entry a verifier could not
 * use is dropped and counted in `skipped`, so one bad key never hides the others.
 *
 * @param text - The served JSON.
 * @example let directory = parse(await response.text());
 */
export function parse(text: string): Result<ParsedSignaturesDirectory, WellKnownParseError> {
	let set = parseJwks(text);
	if (isFailure(set)) {
		return failure(new WellKnownParseError(NAME, set.error.issues));
	}

	let keys = set.data.keys.filter(isDirectoryKey);
	let skipped = set.data.skipped + set.data.keys.length - keys.length;
	return success({ keys, skipped });
}

/**
 * Builds a directory from keys, public or private: each entry keeps its public members,
 * `kid`, `alg`, `nbf` and `exp`, and gets `use: "sig"`. Verifiers match a signature's
 * `keyid` against `kid`, so set it to the key's RFC 7638 thumbprint (`JWK.thumbprint`).
 *
 * @param keys - The signing keys; a private JWK publishes only its public half.
 * @returns The directory, or an issue at every symmetric key and every key without `kid`.
 * @example build([{ ...publicJwk, kid: await thumbprintOf(publicJwk) }])
 */
export function build(keys: DirectoryKey[]): Result<SignaturesDirectory, WellKnownParseError> {
	let issues: WellKnownParseError.Issue[] = [];
	let published: DirectoryKey[] = [];

	for (let [index, key] of keys.entries()) {
		let half = publicHalf(key);
		if (half === null) {
			issues.push({ at: pointer("keys", index), message: `Key ${index} is symmetric.` });
		} else if (half.kid === undefined) {
			issues.push({ at: pointer("keys", index, "kid"), message: `Key ${index} has no kid.` });
		} else {
			published.push({ ...half, use: "sig" });
		}
	}

	if (issues.length > 0) return failure(new WellKnownParseError(NAME, issues));
	return success({ keys: published });
}

/**
 * A directory as a servable format, answered with the registered media type and
 * `Access-Control-Allow-Origin: *` so a browser-based verifier can read it. Serving keeps
 * the public half of every asymmetric key; pass what `build` answers so each carries its `kid`.
 */
export const httpMessageSignaturesDirectory: WellKnownFormat<SignaturesDirectory> = {
	name: NAME,
	mediaType: MEDIA_TYPE,
	placement: "append",
	cors: true,
	stringify(document) {
		let keys = document.keys.map(publicHalf).filter((key) => key !== null);
		return JSON.stringify({ keys });
	},
	parse,
};
