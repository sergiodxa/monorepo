/**
 * A parsed RFC 6570 URI Template: expand it with values, read its parts, and match URIs
 * back to the variables that produced them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { isFailure, success } from "@sdxc/result";

import type { UriTemplateError } from "./error.js";
import type { Variables } from "./expand.js";
import type { Matcher, MatchedValue } from "./match.js";
import type { TemplatePart } from "./syntax.js";

import { expandParts } from "./expand.js";
import { compileMatcher, matchUri } from "./match.js";
import { parseTemplate } from "./parse.js";

/** A well-formed level 4 template. */
export class UriTemplate {
	/** The template text. */
	readonly source: string;

	/** Literal text (percent-encoded as expansion writes it) and expressions, in order. */
	readonly parts: readonly TemplatePart[];

	#matcher: Result<Matcher, UriTemplateError> | undefined;

	private constructor(source: string, parts: TemplatePart[]) {
		this.source = source;
		this.parts = parts;
	}

	/**
	 * Parses a template, refusing unclosed or empty expressions, reserved operators (`=`,
	 * `,`, `!`, `@`, `|`), invalid variable names, prefix lengths outside 1–9999, and literal
	 * characters a URI cannot hold, such as spaces, `"`, `<` and `>`.
	 *
	 * @param source - The template text.
	 * @returns The template, or where and why it is invalid.
	 * @example UriTemplate.parse("/users/{id}{?fields*}");
	 */
	static parse(source: string): Result<UriTemplate, UriTemplateError> {
		let parts = parseTemplate(source);
		if (isFailure(parts)) return parts;
		return success(new UriTemplate(source, parts.data));
	}

	/** Every variable name the template uses, once each, in order of first use. */
	get variableNames(): string[] {
		let names = new Set<string>();
		for (let part of this.parts) {
			if (typeof part !== "string") for (let spec of part.variables) names.add(spec.name);
		}
		return [...names];
	}

	/**
	 * Expands the template. Undefined, `null` and empty composite values disappear along with
	 * their operator's prefix and name; numbers and booleans are written as text.
	 *
	 * @param variables - Values by name.
	 * @returns The URI reference, or a failure when a `:N` prefix is applied to a list or object.
	 * @example unwrap(UriTemplate.parse("/search{?q,page}")).expand({ q: "a b" }); // success("/search?q=a%20b")
	 */
	expand(variables: Variables): Result<string, UriTemplateError> {
		return expandParts(this.parts, variables);
	}

	/**
	 * The variables `uri` was expanded from, `null` when the template cannot produce it. A
	 * value holding a raw `,` comes back as a list, exploded `key=value` items as an object,
	 * and several variables in one expression take one piece each, in order.
	 *
	 * @param uri - The URI to match, compared as written.
	 * @returns The variables or `null`, or a failure when adjacent expressions make the template ambiguous.
	 * @example unwrap(UriTemplate.parse("file:///{+path}")).match("file:///a/b.txt"); // success({ path: "a/b.txt" })
	 */
	match(uri: string): Result<Record<string, MatchedValue> | null, UriTemplateError> {
		this.#matcher ??= compileMatcher(this.parts);
		if (isFailure(this.#matcher)) return this.#matcher;
		return success(matchUri(this.#matcher.data, uri));
	}

	/** The template text, so a template interpolates and serializes as itself. */
	toString(): string {
		return this.source;
	}

	/** The template text, for `JSON.stringify`. */
	toJSON(): string {
		return this.source;
	}
}

/**
 * Parses and expands a template in one call, for a template used once.
 *
 * @param template - The template text.
 * @param variables - Values by name.
 * @returns The URI reference, or why the template is invalid or cannot expand those values.
 * @example expand("{/segments*}{?q}", { segments: ["a", "b"], q: "x" }); // success("/a/b?q=x")
 */
export function expand(template: string, variables: Variables): Result<string, UriTemplateError> {
	let parsed = UriTemplate.parse(template);
	if (isFailure(parsed)) return parsed;
	return parsed.data.expand(variables);
}
