/**
 * The Permissions-Policy header as a typed map from feature to allowlist, written and read
 * through the RFC 9651 Dictionary grammar the header is defined in, so quoting and separators
 * come from the structured-field serializer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type {
	SF,
	StructuredFieldParseError,
	StructuredFieldStringifyError,
} from "@sdxc/structured-fields";

import { isFailure, success } from "@sdxc/result";
import { parse as parseField, stringify as stringifyField, Token } from "@sdxc/structured-fields";

import type { PermissionsPolicy } from "./lib/types.js";

export type { PermissionsPolicy } from "./lib/types.js";

/** Allowlist members the header writes as tokens; every other member is an origin string. */
const TOKEN_MEMBERS: ReadonlySet<string> = new Set(["self", "src", "*"]);

/**
 * Writes the header value: `[]` as `()`, `"*"` as the bare token `*`, `self`/`src` as tokens
 * and origins as strings. An empty policy writes `""`, which means "do not send the header".
 *
 * @param policy - Feature names, as the header spells them, to allowlists
 * @returns The header value, or the path to a feature name or origin RFC 9651 cannot carry
 * @example stringify({ camera: [], geolocation: ["self"] }) // success("camera=(), geolocation=(self)")
 */
export function stringify(
	policy: PermissionsPolicy.Policy,
): Result<string, StructuredFieldStringifyError> {
	let dictionary: Record<string, SF.MemberInput> = {};
	for (let [feature, allowlist] of Object.entries(policy)) {
		if (allowlist === "*") dictionary[feature] = new Token("*");
		else dictionary[feature] = { items: allowlist.map(toBareItem) };
	}
	return stringifyField(dictionary, "dictionary");
}

/**
 * Reads a header value. Members the header's grammar ignores — parameters such as
 * `report-to`, and values that are neither tokens nor strings — are dropped, as a browser does.
 *
 * @param value - The header value
 * @returns The policy, or where the value stops being an RFC 9651 Dictionary
 * @example parse("camera=(), fullscreen=*") // success({ camera: [], fullscreen: "*" })
 */
export function parse(value: string): Result<PermissionsPolicy.Policy, StructuredFieldParseError> {
	let parsed = parseField(value, "dictionary");
	if (isFailure(parsed)) return parsed;

	let policy: PermissionsPolicy.Policy = {};
	for (let [feature, member] of Object.entries(parsed.data)) {
		if ("items" in member) {
			policy[feature] = member.items.flatMap((item) => fromBareItem(item.value) ?? []);
			continue;
		}
		let origin = fromBareItem(member.value);
		if (origin === "*") policy[feature] = "*";
		else if (origin !== null) policy[feature] = [origin];
	}
	return success(policy);
}

/**
 * @param member - An allowlist entry
 * @returns The token for `self`, `src` and `*`, the origin as a string otherwise
 */
function toBareItem(member: string): SF.BareItem {
	return TOKEN_MEMBERS.has(member) ? new Token(member) : member;
}

/**
 * @param item - A parsed bare item
 * @returns The allowlist entry it spells, or `null` for a type the header does not use
 */
function fromBareItem(item: SF.BareItem): string | null {
	if (item instanceof Token) return item.value;
	if (typeof item === "string") return item;
	return null;
}
