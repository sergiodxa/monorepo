/**
 * Writes the typed directives as one Content-Security-Policy value. Every value that could
 * break out of its directive is dropped, so a policy only ever grows stricter through a bad
 * input: a list that loses its last source is written as `'none'`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DirectiveSpec } from "./directives.js";
import type { CSP } from "./types.js";

import { KEYWORDS, SPEC_BY_NAME, TRUSTED_TYPES_KEYWORDS } from "./directives.js";

/**
 * A token that stays inside its directive: printable ASCII other than `;` and `,`, which
 * separate directives and policies, and `'`, which delimits keywords.
 */
const SAFE_TOKEN = /^[\x21-\x26\x28-\x2b\x2d-\x3a\x3c-\x7e]+$/;

/** A nonce or hash value: the base64 or base64url alphabet, optionally padded. */
const BASE64_VALUE = /^[A-Za-z0-9+/_-]+={0,2}$/;

/** A literal nonce or hash source, whose value follows the prefix. */
const NONCE_OR_HASH = /^(nonce|sha256|sha384|sha512)-(.*)$/i;

/**
 * Writes one policy from the directives, in the order the object lists them.
 *
 * @param directives - The typed policy
 * @param options - The nonce substituted for every `"nonce"` source
 * @returns The header value, `""` when no directive is set
 */
export function stringifyDirectives(
	directives: CSP.Directives,
	options: CSP.StringifyOptions = {},
): string {
	let nonce =
		options.nonce !== undefined && BASE64_VALUE.test(options.nonce) ? options.nonce : undefined;
	let written: string[] = [];

	for (let [name, value] of Object.entries(directives)) {
		let spec = SPEC_BY_NAME.get(name);
		if (spec === undefined || value === undefined || value === null) continue;
		let directive = stringifyDirective(spec, value, nonce);
		if (directive !== null) written.push(directive);
	}

	return written.join("; ");
}

/**
 * Writes one directive by its grammar.
 *
 * @param spec - The directive's wire name and grammar
 * @param value - The typed value, of the shape `spec.kind` implies
 * @param nonce - The validated nonce, when the response has one
 * @returns The directive text, or `null` when nothing writable is left of it
 */
function stringifyDirective(
	spec: DirectiveSpec,
	value: unknown,
	nonce: string | undefined,
): string | null {
	switch (spec.kind) {
		case "sources": {
			let sources = (value as string[]).flatMap((source) => stringifySource(source, nonce) ?? []);
			return `${spec.wire} ${sources.length === 0 ? "'none'" : sources.join(" ")}`;
		}
		case "sandbox": {
			if (value === true) return spec.wire;
			return [spec.wire, ...(value as string[]).filter((token) => SAFE_TOKEN.test(token))].join(
				" ",
			);
		}
		case "token": {
			return SAFE_TOKEN.test(value as string) ? `${spec.wire} ${value as string}` : null;
		}
		case "tokens": {
			let tokens = (value as string[]).filter((token) => SAFE_TOKEN.test(token));
			return tokens.length === 0 ? null : `${spec.wire} ${tokens.join(" ")}`;
		}
		case "flag": {
			return value === true ? spec.wire : null;
		}
		case "trusted-types-for": {
			return `${spec.wire} 'script'`;
		}
		case "trusted-types": {
			let names = (value as string[]).flatMap((name) => {
				let bare = unquote(name);
				if (TRUSTED_TYPES_KEYWORDS.has(bare.toLowerCase())) return `'${bare.toLowerCase()}'`;
				return SAFE_TOKEN.test(bare) ? bare : [];
			});
			return [spec.wire, ...names].join(" ");
		}
	}
}

/**
 * Writes one source expression, quoting keywords, nonces and hashes.
 *
 * @param source - The source as the model spells it, quoted or not
 * @param nonce - The validated nonce substituted for `"nonce"`
 * @returns The wire form, or `null` when the source is dropped
 */
function stringifySource(source: string, nonce: string | undefined): string | null {
	let bare = unquote(source);
	let lower = bare.toLowerCase();

	if (KEYWORDS.has(lower)) return `'${lower}'`;
	if (lower === "nonce") return nonce === undefined ? null : `'nonce-${nonce}'`;

	let literal = NONCE_OR_HASH.exec(bare);
	if (literal !== null) {
		let [, algorithm = "", value = ""] = literal;
		return BASE64_VALUE.test(value) ? `'${algorithm.toLowerCase()}-${value}'` : null;
	}

	return SAFE_TOKEN.test(bare) ? bare : null;
}

/**
 * @param token - A source or keyword, possibly written in its quoted wire form
 * @returns The token without one pair of surrounding single quotes
 */
export function unquote(token: string): string {
	if (token.length >= 2 && token.startsWith("'") && token.endsWith("'")) {
		return token.slice(1, -1);
	}
	return token;
}
