/**
 * The JSON Web Key Set document (RFC 7517 §5): a reader that drops unusable entries
 * and still reads the set, and a writer that refuses private key material, the one
 * mistake that turns publishing keys into leaking one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { WellKnownFormat } from "./format.js";

import { isObject, pointer, readJsonObject } from "./lib/json.js";
import { WellKnownParseError } from "./parse-error.js";

export const NAME = "jwks.json";
export const MEDIA_TYPE = "application/json";

/**
 * One key, with the members RFC 7517 §4 and the key types of RFC 7518 §6 and RFC 8037
 * register, as Web Crypto imports it. Any interface-typed JWK with those members fits.
 */
export interface Jwk {
	kty: string;
	kid?: string;
	use?: string;
	key_ops?: string[];
	alg?: string;
	ext?: boolean;
	x5u?: string;
	x5c?: string[];
	x5t?: string;
	"x5t#S256"?: string;
	crv?: string;
	x?: string;
	y?: string;
	n?: string;
	e?: string;
	d?: string;
	p?: string;
	q?: string;
	dp?: string;
	dq?: string;
	qi?: string;
	oth?: { r?: string; d?: string; t?: string }[];
	k?: string;
}

export interface JwkSet {
	keys: Jwk[];
}

export interface ParsedJwkSet extends JwkSet {
	/**
	 * Entries dropped per RFC 7517 §5: not objects, lacking `kty`, or lacking a member
	 * their `EC`, `RSA`, `OKP` or `oct` key type requires.
	 */
	skipped: number;
}

/** Members that carry private or symmetric key material (RFC 7518 §6). */
const PRIVATE_MEMBERS = ["d", "p", "q", "dp", "dq", "qi", "oth", "k"] as const;

/** The members each key type RFC 7518 and RFC 8037 register cannot be imported without. */
const REQUIRED_MEMBERS: Record<string, readonly string[]> = {
	EC: ["crv", "x", "y"],
	RSA: ["n", "e"],
	OKP: ["crv", "x"],
	oct: ["k"],
};

/**
 * Whether an entry can stand as a key: an object with a string `kty` and, for a
 * registered key type, its required members. An unregistered `kty` is kept, since
 * whether it is understood is the importing code's decision.
 *
 * @param entry - One element of `keys`.
 */
function isUsableKey(entry: unknown): entry is Jwk {
	if (!isObject(entry) || typeof entry.kty !== "string") return false;
	let required = REQUIRED_MEMBERS[entry.kty] ?? [];
	return required.every((member) => typeof entry[member] === "string");
}

/**
 * Reads a key set. A missing or non-array `keys` fails; an unusable entry is dropped
 * and counted in `skipped`, so one malformed key never hides the others.
 *
 * @param text - The served JSON.
 * @example
 * let set = parse(await response.text());
 * if (isSuccess(set)) for (let key of set.data.keys) await crypto.subtle.importKey("jwk", key, …);
 */
export function parse(text: string): Result<ParsedJwkSet, WellKnownParseError> {
	let decoded = readJsonObject(text, NAME);
	if (decoded.status === "failure") return decoded;

	let entries = decoded.data.keys;
	if (!Array.isArray(entries)) {
		return failure(
			new WellKnownParseError(NAME, [{ at: "/keys", message: '"keys" is not an array.' }]),
		);
	}

	let keys = entries.filter(isUsableKey);
	return success({ keys, skipped: entries.length - keys.length });
}

/**
 * Writes a key set for publishing. Any private member (`d`, `p`, `q`, `dp`, `dq`, `qi`,
 * `oth`, `k`) fails with an issue at that member, so a key pair passed in place of its
 * public half is caught before it is served.
 *
 * @param document - The public keys.
 */
export function stringify(document: JwkSet): Result<string, WellKnownParseError> {
	let issues: WellKnownParseError.Issue[] = [];
	for (let [index, key] of document.keys.entries()) {
		for (let member of PRIVATE_MEMBERS) {
			if (member in key) {
				issues.push({
					at: pointer("keys", index, member),
					message: `Key ${index} carries the private member "${member}".`,
				});
			}
		}
	}
	if (issues.length > 0) return failure(new WellKnownParseError(NAME, issues));
	return success(JSON.stringify({ keys: document.keys }));
}

/**
 * The public half of a key: every private member removed, or `null` for a symmetric
 * key, which has no public half.
 *
 * @param key - A key, public or private.
 */
function publicHalf(key: Jwk): Jwk | null {
	if (key.kty === "oct") return null;
	let result: Jwk = { ...key };
	for (let member of PRIVATE_MEMBERS) delete result[member];
	return result;
}

/**
 * A key set as a servable format. Serving publishes the public half of every key and
 * leaves symmetric keys out, so a response can never carry private material; use
 * `stringify` to have a private member reported instead.
 */
export const jwks: WellKnownFormat<JwkSet> = {
	name: NAME,
	mediaType: MEDIA_TYPE,
	placement: "insert",
	cors: false,
	stringify(document) {
		let keys = document.keys.map(publicHalf).filter((key) => key !== null);
		return JSON.stringify({ keys });
	},
	parse,
};
