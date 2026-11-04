/**
 * Turns this package's unquoted CSP directives into the quoted token object Remix's `csp()`
 * middleware expects, substituting the request nonce for every `"nonce"` source.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ContentSecurityPolicyInit } from "remix/headers/content-security-policy";

import type { CSP } from "./lib/types.js";

import { stringify } from "./csp.js";

/**
 * Directive object shape accepted by Remix's `csp({ policy })` and
 * `csp({ reportOnlyPolicy })` factories (quoted CSP tokens, camelCase keys).
 */
export type RemixCspDirectives = ContentSecurityPolicyInit;

/**
 * Quotes keywords and substitutes `nonce` so the result can be returned from a Remix `csp()`
 * policy factory. Sources that would break out of a directive are dropped, matching `stringify`.
 *
 * @param directives - This package's unquoted directive object
 * @param nonce - The request nonce from the Remix factory's `{ nonce }`
 * @returns Directives with quoted keywords and `'nonce-…'` sources, ready for `csp()`
 * @example remixCsp({ scriptSrc: ["self", "nonce"] }, nonce) // { scriptSrc: ["'self'", "'nonce-…'"] }
 */
export function remixCsp(directives: CSP.Directives, nonce: string): RemixCspDirectives {
	let serialized = stringify(directives, { nonce });
	if (serialized === "") return {};

	let result: Record<string, string[] | boolean | string> = {};
	for (let directive of serialized.split(";")) {
		let tokens = directive.trim().split(/\s+/).filter(Boolean);
		let name = tokens.shift();
		if (!name) continue;
		let key = name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
		if (tokens.length === 0) {
			/** Remix encodes a valueless `sandbox` as an empty token list. */
			result[key] = key === "sandbox" ? [] : true;
		} else if (key === "reportTo") {
			result[key] = tokens[0] ?? "";
		} else {
			result[key] = tokens;
		}
	}
	return result as RemixCspDirectives;
}
