/**
 * Reads, validates and writes RFC 9553 JSContact Cards at version 2.0 (RFC 9982), the JSON
 * counterpart of vCard: the typed Card model, its PatchObjects and localizations, and the
 * `application/jscontact+json` media type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { PatchError } from "./lib/errors.js";
import type { Issue } from "./lib/errors.js";
import type { JSContact } from "./types.js";

import { JSContactParseError } from "./lib/errors.js";
import { applyPatch } from "./lib/patch.js";
import { CARD_SCHEMA } from "./lib/schema.js";

export type { JSContact } from "./types.js";
export type { Issue } from "./lib/errors.js";

export { JSContactParseError, PatchError, VCardParseError } from "./lib/errors.js";
export { applyPatch } from "./lib/patch.js";
export { CARD_SCHEMA } from "./lib/schema.js";
export { isId, isUTCDateTime } from "./lib/values.js";

/** The media type of a JSContact Card (RFC 9553 §3.1), with the version it is written in. */
export const MEDIA_TYPE = "application/jscontact+json;version=2.0";

/** The version this package writes. */
export const VERSION = "2.0";

/** The issues of a failed validation as plain paths and messages. */
function issuesOf(issues: ReadonlyArray<s.Issue>): Issue[] {
	return issues.map((issue) => ({
		path: (issue.path ?? []).map((segment) =>
			typeof segment === "object" ? (segment.key as string | number) : (segment as string | number),
		),
		message: issue.message,
	}));
}

/**
 * Reads and validates a Card. A string is parsed as JSON first; any other value is validated
 * as already-parsed JSON. Unknown and vendor-specific properties are kept, so a Card read and
 * written back loses nothing.
 *
 * @param source - JSON text, or the value `JSON.parse` returned
 * @returns The Card, or every problem found
 * @example parse(await request.text());
 */
export function parse(source: unknown): Result<JSContact.Card, JSContactParseError> {
	let value = source;
	if (typeof source === "string") {
		try {
			value = JSON.parse(source);
		} catch (error) {
			let reason = error instanceof Error ? error.message : String(error);
			return failure(new JSContactParseError(`The text is not JSON: ${reason}`));
		}
	}
	let result = s.parseSafe(CARD_SCHEMA, value);
	if (result.success) return success(result.value);
	let issues = issuesOf(result.issues);
	let [first] = issues;
	let where = first && first.path.length > 0 ? ` at ${first.path.join(".")}` : "";
	return failure(
		new JSContactParseError(
			`Invalid JSContact Card${where}: ${first?.message ?? "unknown"}`,
			issues,
		),
	);
}

/**
 * Writes a Card as JSON text, the body of an `application/jscontact+json` response.
 *
 * @param card - The Card
 * @returns Compact JSON
 */
export function stringify(card: JSContact.Card): string {
	return JSON.stringify(card);
}

/**
 * The Card as it reads in another language: its `localizations` patch for that language
 * applied to a copy, which then names the language and carries no localizations. The tag is
 * matched case-insensitively; a Card with no patch for it answers the Card unchanged.
 *
 * @param card - The Card
 * @param language - An RFC 5646 tag such as `uk-Cyrl`
 * @returns The localized copy, or why its patch cannot be applied
 * @example localize(card, "fr");
 */
export function localize(
	card: JSContact.Card,
	language: string,
): Result<JSContact.Card, PatchError> {
	let wanted = language.toLowerCase();
	let entry = Object.entries(card.localizations ?? {}).find(
		([tag]) => tag.toLowerCase() === wanted,
	);
	if (entry === undefined) return success(card);

	let { localizations: _, ...base } = card;
	let patched = applyPatch(base as JSContact.Card, entry[1]);
	if (isFailure(patched)) return patched;
	return success({ ...patched.data, language: entry[0] });
}
