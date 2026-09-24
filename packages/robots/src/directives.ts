/**
 * Reads and writes the per-page robots directives that `X-Robots-Tag` and the `robots` meta tag
 * share: comma-separated directives, optionally scoped to one bot (`googlebot: noindex`), some
 * carrying a value (`max-snippet: 50`). Directives the list does not name land in `other`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { productToken } from "./index.js";

/** The directives that carry a value after a colon, which a bot name never is. */
const VALUED = new Set([
	"max-snippet",
	"max-image-preview",
	"max-video-preview",
	"unavailable_after",
]);

/** Image preview sizes from least to most permissive. */
const IMAGE_PREVIEWS = ["none", "standard", "large"] as const;

/** A whole number, as `max-snippet` and `max-video-preview` take (`-1` means no limit). */
const INTEGER = /^-?\d+$/;

/** An `unavailable_after` that stops at a weekday name, whose date the comma split off. */
const SPLIT_WEEKDAY = /unavailable_after\s*:\s*[A-Za-z]+$/i;

/** The boolean directives, each mapped to the fields it turns on. */
const FLAGS: { [directive: string]: (keyof Directives.Flags)[] } = {
	noindex: ["noindex"],
	nofollow: ["nofollow"],
	none: ["noindex", "nofollow"],
	noarchive: ["noarchive"],
	nosnippet: ["nosnippet"],
	noimageindex: ["noimageindex"],
	notranslate: ["notranslate"],
	all: [],
	index: [],
	follow: [],
};

/** Types for per-page robots directives. */
export namespace Directives {
	/** The directives that are on or off. */
	export interface Flags {
		/** `none` sets both `noindex` and `nofollow`. */
		noindex: boolean;
		nofollow: boolean;
		noarchive: boolean;
		nosnippet: boolean;
		noimageindex: boolean;
		notranslate: boolean;
	}

	/** The directives addressed to one bot, or to every bot. */
	export interface Set extends Flags {
		/** The bot the set is scoped to, lower-cased; `null` for a set that applies to every bot. */
		botName: string | null;
		/** Characters of text a snippet may show; `-1` for no limit. */
		maxSnippet?: number;
		maxImagePreview?: "none" | "standard" | "large";
		/** Seconds of video a preview may show; `-1` for no limit. */
		maxVideoPreview?: number;
		unavailableAfter?: Date;
		/** Directives outside the list above, lower-cased, e.g. `noai`; unreadable values keep their text. */
		other: string[];
	}

	/** How a set is written. */
	export interface StringifyOptions {
		/** Spells out `index` and `follow` instead of omitting the defaults. */
		explicit?: boolean;
	}
}

/**
 * Reads one header or meta value. A `name:` that is not a value-carrying directive scopes what
 * follows to that bot until the next scope; directives before the first scope form an unscoped
 * set. Sets come back in order of first appearance, one per bot.
 *
 * @param value - An `X-Robots-Tag` value or a `robots` meta tag's content.
 * @returns The sets the value declares; none for an empty value.
 * @example parseDirectives("googlebot: noindex, nofollow")
 */
export function parseDirectives(value: string): Directives.Set[] {
	let sets = new Map<string | null, Directives.Set>();
	let current: Directives.Set | null = null;

	for (let token of tokens(value)) {
		let colon = token.indexOf(":");
		let name = (colon === -1 ? token : token.slice(0, colon)).trim().toLowerCase();

		if (colon !== -1 && !VALUED.has(name)) {
			current = sets.get(name) ?? emptySet(name);
			sets.set(name, current);
			token = token.slice(colon + 1).trim();
			if (token === "") continue;
		}

		if (current === null) {
			current = sets.get(null) ?? emptySet(null);
			sets.set(null, current);
		}

		apply(current, token);
	}

	return [...sets.values()];
}

/**
 * Merges every `X-Robots-Tag` on a response into the set that applies to one bot: the unscoped
 * sets plus the ones naming its product token. Where two disagree the more restrictive wins: a
 * flag set anywhere is on, and the smaller limit and earlier `unavailable_after` apply.
 *
 * @param response - The response whose headers carry the directives.
 * @param userAgent - The crawler's identification string; only its product token is compared.
 * @example let cacheable = !directivesFor(response, AGENT).noarchive;
 */
export function directivesFor(response: Response, userAgent: string): Directives.Set {
	let token = productToken(userAgent);
	let merged = emptySet(null);

	for (let set of parseDirectives(response.headers.get("x-robots-tag") ?? "")) {
		if (set.botName !== null && set.botName !== token) continue;
		merge(merged, set);
	}

	return merged;
}

/**
 * Writes a set as a header or meta value, scoped with `botName:` when it has one. Defaults are
 * omitted unless `explicit` spells out `index` and `follow`, which is how a meta tag states its
 * full policy.
 *
 * @param set - The directives to write; missing fields are off.
 * @param options - Whether to spell out the defaults.
 * @example stringifyDirectives({ noindex: true }, { explicit: true }) // "noindex, follow"
 */
export function stringifyDirectives(
	set: Partial<Directives.Set>,
	options: Directives.StringifyOptions = {},
): string {
	let parts: string[] = [];

	if (set.noindex) parts.push("noindex");
	else if (options.explicit) parts.push("index");
	if (set.nofollow) parts.push("nofollow");
	else if (options.explicit) parts.push("follow");

	for (let flag of ["noarchive", "nosnippet", "noimageindex", "notranslate"] as const) {
		if (set[flag]) parts.push(flag);
	}

	if (set.maxSnippet !== undefined) parts.push(`max-snippet: ${set.maxSnippet}`);
	if (set.maxImagePreview !== undefined) parts.push(`max-image-preview: ${set.maxImagePreview}`);
	if (set.maxVideoPreview !== undefined) parts.push(`max-video-preview: ${set.maxVideoPreview}`);
	if (set.unavailableAfter !== undefined) {
		parts.push(`unavailable_after: ${set.unavailableAfter.toISOString()}`);
	}
	parts.push(...(set.other ?? []));

	let written = parts.join(", ");
	return set.botName ? `${set.botName}: ${written}` : written;
}

/**
 * The comma-separated directives of a value, trimmed and non-empty. An RFC 850 date's comma
 * (`unavailable_after: Thursday, 31-Dec-26 …`) is put back, so the date stays one directive.
 */
function tokens(value: string): string[] {
	let result: string[] = [];

	for (let part of value.split(",")) {
		let previous = result.at(-1);
		if (previous !== undefined && SPLIT_WEEKDAY.test(previous)) {
			result[result.length - 1] = `${previous}, ${part.trim()}`;
			continue;
		}
		if (part.trim() !== "") result.push(part.trim());
	}

	return result;
}

/** A set with every directive off. */
function emptySet(botName: string | null): Directives.Set {
	return {
		botName,
		noindex: false,
		nofollow: false,
		noarchive: false,
		nosnippet: false,
		noimageindex: false,
		notranslate: false,
		other: [],
	};
}

/** Applies one directive to a set; an unknown one, or one whose value does not read, goes to `other`. */
function apply(set: Directives.Set, directive: string): void {
	let colon = directive.indexOf(":");
	let name = (colon === -1 ? directive : directive.slice(0, colon)).trim().toLowerCase();
	let value = colon === -1 ? "" : directive.slice(colon + 1).trim();

	let flags = colon === -1 ? FLAGS[name] : undefined;
	if (flags !== undefined) {
		for (let flag of flags) set[flag] = true;
		return;
	}

	if (name === "max-snippet" && INTEGER.test(value)) {
		set.maxSnippet = Number(value);
		return;
	}

	if (name === "max-video-preview" && INTEGER.test(value)) {
		set.maxVideoPreview = Number(value);
		return;
	}

	let preview = IMAGE_PREVIEWS.find((size) => size === value.toLowerCase());
	if (name === "max-image-preview" && preview !== undefined) {
		set.maxImagePreview = preview;
		return;
	}

	let date = new Date(value);
	if (name === "unavailable_after" && value !== "" && !Number.isNaN(date.getTime())) {
		set.unavailableAfter = date;
		return;
	}

	set.other.push(colon === -1 ? name : `${name}: ${value}`);
}

/** Folds one set into another, keeping the more restrictive of each directive. */
function merge(into: Directives.Set, from: Directives.Set): void {
	for (let flag of [
		"noindex",
		"nofollow",
		"noarchive",
		"nosnippet",
		"noimageindex",
		"notranslate",
	] as const) {
		into[flag] ||= from[flag];
	}

	let snippet = stricterLimit(into.maxSnippet, from.maxSnippet);
	if (snippet !== undefined) into.maxSnippet = snippet;

	let video = stricterLimit(into.maxVideoPreview, from.maxVideoPreview);
	if (video !== undefined) into.maxVideoPreview = video;

	if (from.maxImagePreview !== undefined) {
		let rank = (size: Directives.Set["maxImagePreview"]) => IMAGE_PREVIEWS.indexOf(size ?? "large");
		if (
			into.maxImagePreview === undefined ||
			rank(from.maxImagePreview) < rank(into.maxImagePreview)
		) {
			into.maxImagePreview = from.maxImagePreview;
		}
	}

	if (from.unavailableAfter !== undefined) {
		if (into.unavailableAfter === undefined || from.unavailableAfter < into.unavailableAfter) {
			into.unavailableAfter = from.unavailableAfter;
		}
	}

	for (let directive of from.other) if (!into.other.includes(directive)) into.other.push(directive);
}

/** The stricter of two limits, where `-1` means no limit and a missing one imposes nothing. */
function stricterLimit(a: number | undefined, b: number | undefined): number | undefined {
	if (a === undefined || a === -1) return b ?? a;
	if (b === undefined || b === -1) return a;
	return Math.min(a, b);
}
