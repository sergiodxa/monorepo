/**
 * Reads a Content-Security-Policy value into the typed model, following CSP Level 3's
 * "parse a serialized CSP list": comma-joined policies, `;`-separated directives, names
 * lowercased, and a repeated directive ignored after its first occurrence.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { DirectiveSpec } from "./directives.js";
import type { CSP } from "./types.js";

import { KEYWORDS, SPEC_BY_WIRE } from "./directives.js";
import { CSPParseError } from "./errors.js";
import { unquote } from "./stringify-csp.js";

/** CSP's directive-name grammar: `1*( ALPHA / DIGIT / "-" )`. */
const DIRECTIVE_NAME = /^[A-Za-z0-9-]+$/;

/** ASCII whitespace as the CSP grammar defines it: tab, line feed, form feed, carriage return, space. */
const ASCII_WHITESPACE = /[\t\n\f\r ]+/;

/** A literal nonce or hash source, whose algorithm prefix is case-insensitive. */
const NONCE_OR_HASH = /^(nonce|sha256|sha384|sha512)-/i;

/**
 * Parses a header value into its policies. A policy with no directives is skipped, so an empty
 * value parses to an empty list.
 *
 * @param value - The header value, possibly several comma-joined policies
 * @returns One entry per policy, or where the value leaves the grammar
 */
export function parsePolicies(value: string): Result<CSP.Parsed[], CSPParseError> {
	for (let index = 0; index < value.length; index++) {
		let code = value.charCodeAt(index);
		let visible = code >= 0x21 && code <= 0x7e;
		let whitespace =
			code === 0x09 || code === 0x0a || code === 0x0c || code === 0x0d || code === 0x20;
		if (!visible && !whitespace) {
			return failure(new CSPParseError("Character outside printable ASCII", index));
		}
	}

	let policies: CSP.Parsed[] = [];
	let offset = 0;

	for (let serialized of value.split(",")) {
		let parsed = parsePolicy(serialized, offset);
		if (parsed.status === "failure") return parsed;
		let hasDirectives =
			Object.keys(parsed.data.directives).length > 0 || Object.keys(parsed.data.unknown).length > 0;
		if (hasDirectives) policies.push(parsed.data);
		offset += serialized.length + 1;
	}

	return success(policies);
}

/**
 * Parses one serialized policy.
 *
 * @param serialized - The text between two commas
 * @param offset - Where `serialized` starts in the whole header value, for error positions
 * @returns The policy, or the position of an invalid directive name
 */
function parsePolicy(serialized: string, offset: number): Result<CSP.Parsed, CSPParseError> {
	let directives: CSP.Directives = {};
	let unknown: Record<string, string[]> = {};
	let seen = new Set<string>();
	let start = offset;

	for (let token of serialized.split(";")) {
		let leading = token.length - token.trimStart().length;
		let [rawName = "", ...values] = token.trim().split(ASCII_WHITESPACE);
		let position = start + leading;
		start += token.length + 1;
		if (rawName === "") continue;
		if (!DIRECTIVE_NAME.test(rawName)) {
			return failure(new CSPParseError("Invalid directive name", position));
		}

		let name = rawName.toLowerCase();
		let spec = SPEC_BY_WIRE.get(name);
		let modelled = spec === undefined ? undefined : readDirective(spec, values);

		if (seen.has(name) || spec === undefined || modelled === undefined) {
			if (!(name in unknown)) unknown[name] = values;
		} else {
			assign(directives, spec.name, modelled);
		}
		seen.add(name);
	}

	return success({ directives, unknown });
}

/**
 * Stores a directive's value under its typed name.
 *
 * @param directives - The policy being built
 * @param name - The typed directive name
 * @param value - A value `readDirective` produced for that name
 */
function assign(directives: CSP.Directives, name: keyof CSP.Directives, value: unknown): void {
	(directives as Record<string, unknown>)[name] = value;
}

/**
 * Reads a modelled directive's tokens by its grammar.
 *
 * @param spec - The directive's typed name and grammar
 * @param values - The tokens after the directive name
 * @returns The typed value, or `undefined` when the tokens do not fit the model, which places
 *   the directive in `unknown`
 */
function readDirective(spec: DirectiveSpec, values: string[]): unknown {
	switch (spec.kind) {
		case "sources":
			return values.map(readSource);
		case "sandbox":
			return values.length === 0 ? true : values;
		case "token":
			return values.length === 1 ? values[0] : undefined;
		case "tokens":
			return values;
		case "flag":
			return values.length === 0 ? true : undefined;
		case "trusted-types-for":
			return values.length === 1 && values[0]?.toLowerCase() === "'script'"
				? ["script"]
				: undefined;
		case "trusted-types":
			return values.map((name) => {
				let bare = unquote(name);
				return bare === name ? name : bare.toLowerCase();
			});
	}
}

/**
 * Reads one source expression into the model's unquoted spelling.
 *
 * @param token - The source as the header writes it
 * @returns Keywords lowercased and unquoted, nonces and hashes unquoted, anything else as-is
 */
function readSource(token: string): string {
	let bare = unquote(token);
	if (bare === token) return token;
	let lower = bare.toLowerCase();
	if (KEYWORDS.has(lower)) return lower;
	let prefix = NONCE_OR_HASH.exec(bare);
	if (prefix !== null) return `${prefix[1]?.toLowerCase()}-${bare.slice(prefix[0].length)}`;
	return token;
}
