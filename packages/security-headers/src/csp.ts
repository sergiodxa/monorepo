/**
 * Content Security Policy Level 3 as a typed object: write one policy with keywords quoted and
 * a per-response nonce substituted, read a header back (several policies included), and layer
 * a route's changes over an app's base policy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { Base64, randomBytes } from "@sdxc/crypto";

import type { CSP } from "./lib/types.js";

import { CSPParseError } from "./lib/errors.js";
import { parsePolicies } from "./lib/parse-csp.js";
import { stringifyDirectives } from "./lib/stringify-csp.js";

export type { CSP } from "./lib/types.js";

export { CSPParseError };

/** Bytes of entropy behind a nonce: 128 bits, the minimum CSP Level 3 recommends. */
const NONCE_BYTES = 16;

/**
 * Writes one policy. A source list left empty once `"nonce"` is dropped is written as
 * `'none'`, so a policy never grows more permissive by losing its nonce; a source that would
 * break out of its directive (whitespace, `;`, `,`) is dropped the same way.
 *
 * @param directives - The typed policy, written in the order its keys are listed
 * @param options - The nonce substituted for every `"nonce"` source
 * @returns The header value, `""` when no directive is set
 * @example stringify({ scriptSrc: ["self", "nonce"] }, { nonce }) // "script-src 'self' 'nonce-…'"
 */
export function stringify(directives: CSP.Directives, options?: CSP.StringifyOptions): string {
	return stringifyDirectives(directives, options);
}

/**
 * Parses a header value, which may hold several comma-joined policies, each one enforced by
 * the browser. A repeated directive keeps its first value; the repeat lands in `unknown`.
 *
 * @param value - The header value
 * @returns One entry per policy, or the position where the value leaves the CSP grammar
 * @example parse("script-src 'self'") // success([{ directives: { scriptSrc: ["self"] }, unknown: {} }])
 */
export function parse(value: string): Result<CSP.Parsed[], CSPParseError> {
	return parsePolicies(value);
}

/**
 * Replaces each directive the override names, removing those it sets to `null`. Directives the
 * base already lists keep their position, so the written policy stays in a stable order.
 *
 * @param base - The policy being patched, left untouched
 * @param override - Directives to replace (a value) or remove (`null`)
 * @returns A new policy
 * @example merge(base, { frameAncestors: ["*"], sandbox: null })
 */
export function merge(base: CSP.Directives, override: CSP.Override): CSP.Directives {
	let merged: Record<string, unknown> = { ...base };
	for (let [name, value] of Object.entries(override)) {
		if (value === null) delete merged[name];
		else if (value !== undefined) merged[name] = value;
	}
	return merged as CSP.Directives;
}

/**
 * Generates a per-response nonce. A nonce is only unguessable while it is used once, so call
 * this for every response rather than reusing a value.
 *
 * @returns 16 random bytes as padded base64
 */
export function generateNonce(): string {
	return Base64.encode(randomBytes(NONCE_BYTES));
}
