/**
 * Writes and reads RFC 9213 targeted cache fields such as `CDN-Cache-Control`, which give one
 * class of cache (a CDN, or one vendor's edge) its own lifetime apart from `Cache-Control`.
 * They are Structured Field Dictionaries, so both directions go through that grammar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SF } from "@sdxc/structured-fields";
import type { CacheControlInit } from "remix/headers";

import { isFailure } from "@sdxc/result";
import { parse, stringify } from "@sdxc/structured-fields";
import { CacheControl } from "remix/headers";

import type { PolicyOptions } from "./policy.js";

import { policy } from "./policy.js";

/** The `CacheControl` fields whose directive carries a number of seconds. */
type AgeKey = "maxAge" | "sMaxage" | "staleWhileRevalidate" | "staleIfError";

/** The `CacheControl` fields whose directive is present or absent. */
type FlagKey =
	| "public"
	| "private"
	| "noCache"
	| "noStore"
	| "noTransform"
	| "mustRevalidate"
	| "proxyRevalidate"
	| "mustUnderstand"
	| "immutable";

/** Directives whose value is an Integer number of seconds, in the order they are written. */
const AGE_DIRECTIVES: readonly (readonly [string, AgeKey])[] = [
	["max-age", "maxAge"],
	["s-maxage", "sMaxage"],
	["stale-while-revalidate", "staleWhileRevalidate"],
	["stale-if-error", "staleIfError"],
];

/** Directives written as a bare key, in the order they are written. */
const FLAG_DIRECTIVES: readonly (readonly [string, FlagKey])[] = [
	["public", "public"],
	["private", "private"],
	["no-cache", "noCache"],
	["no-store", "noStore"],
	["no-transform", "noTransform"],
	["must-revalidate", "mustRevalidate"],
	["proxy-revalidate", "proxyRevalidate"],
	["must-understand", "mustUnderstand"],
	["immutable", "immutable"],
];

/**
 * Directives that may instead carry a String listing field names. A cache reading one takes
 * the unqualified directive, which withholds the whole response rather than some fields.
 */
const QUALIFIABLE_DIRECTIVES: ReadonlySet<string> = new Set(["private", "no-cache"]);

/** The largest Integer a Structured Field can carry. */
const MAX_INTEGER = 999_999_999_999_999;

/**
 * Builds a targeted cache field value from the same description `policy()` takes, so an
 * edge-only lifetime reads like any other. An empty description yields `""`, which caches
 * ignore, leaving `Cache-Control` in charge.
 *
 * @param options - Visibility, ages, and directives to emit; all optional.
 * @returns The Structured Field Dictionary text for `CDN-Cache-Control` and its kin.
 * @example
 * headers.set("CDN-Cache-Control", targetedPolicy({ maxAge: "1 day" })); // "max-age=86400"
 */
export function targetedPolicy(options: PolicyOptions = {}): string {
	let control = policy(options);
	let dictionary: Record<string, SF.MemberInput> = {};

	for (let [name, key] of FLAG_DIRECTIVES) if (control[key]) dictionary[name] = true;
	for (let [name, key] of AGE_DIRECTIVES) {
		let seconds = control[key];
		if (seconds !== undefined) dictionary[name] = Math.min(Math.max(seconds, 0), MAX_INTEGER);
	}

	let text = stringify(dictionary, "dictionary");
	return isFailure(text) ? "" : text.data;
}

/**
 * Reads a targeted cache field. `null` means a cache ignores the field (absent, empty, or not a
 * valid Dictionary) and falls back to the next one; any other result governs, even with no
 * known directive. Parameters, unknown directives and ill-typed values are skipped.
 *
 * @param value - The field value, as `Headers#get` returns it.
 * @returns The directives the field sets, or `null` when the field is ignored.
 * @example
 * parseTargetedPolicy(response.headers.get("CDN-Cache-Control"))?.maxAge; // 86400
 */
export function parseTargetedPolicy(value: string | null | undefined): CacheControl | null {
	if (value === null || value === undefined) return null;

	let parsed = parse(value, "dictionary");
	if (isFailure(parsed)) return null;

	let members = Object.entries(parsed.data);
	if (members.length === 0) return null;

	let init: CacheControlInit = {};
	for (let [name, member] of members) {
		if ("items" in member) continue;
		readDirective(init, name, member.value);
	}

	return new CacheControl(init);
}

/**
 * Copies one directive into the init when its value has the type the directive allows: a
 * non-negative Integer for an age, Boolean true for a flag, or a String for `private` and
 * `no-cache`. Anything else is skipped, since coercing it would diverge from other caches.
 *
 * @param init - The directives read so far.
 * @param name - The directive's key in the Dictionary.
 * @param value - The member's bare value.
 */
function readDirective(init: CacheControlInit, name: string, value: SF.BareItem): void {
	let age = AGE_DIRECTIVES.find(([directive]) => directive === name);
	if (age) {
		if (typeof value === "number" && Number.isInteger(value) && value >= 0) init[age[1]] = value;
		return;
	}

	let flag = FLAG_DIRECTIVES.find(([directive]) => directive === name);
	if (!flag) return;
	if (value === true || (QUALIFIABLE_DIRECTIVES.has(name) && typeof value === "string")) {
		init[flag[1]] = true;
	}
}
