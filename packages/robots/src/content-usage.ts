/**
 * Reads and writes the `Content-Usage` HTTP field, which attaches an AI Preferences statement to
 * the content of one response. The same statement in robots.txt applies by path; this field
 * applies to the representation it travels with, and the two combine most-restrictive-first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { combinePreferences, readPreferences, writePreferences } from "./lib/usage.js";

import type { Robots } from "./index.js";

export { combinePreferences };

/** The field name the AI Preferences attachment draft registers. */
export const CONTENT_USAGE = "Content-Usage";

/**
 * Reads a statement of preference, as the field or a robots.txt rule carries it. A value that is
 * not a valid Dictionary, an uppercase label included, leaves every category unknown.
 *
 * @param value - The statement, such as `train-ai=n, search=y`.
 * @returns The labels set to the Token `y` (`true`) or `n` (`false`).
 * @example parseContentUsage("train-ai=n, search=y") // { "train-ai": false, search: true }
 */
export function parseContentUsage(value: string): Robots.UsagePreferences {
	return readPreferences(value);
}

/**
 * Writes a statement of preference in canonical Dictionary form. Unknown categories and labels
 * outside Dictionary key syntax are left out.
 *
 * @param preferences - `true` allows a category of use and `false` disallows it.
 * @returns The statement, `""` when no category has a preference.
 * @example stringifyContentUsage({ search: true, "train-ai": false }) // "search=y, train-ai=n"
 */
export function stringifyContentUsage(preferences: Robots.UsagePreferences): string {
	return writePreferences(preferences);
}

/**
 * The preferences a message's `Content-Usage` field states. Repeated field lines combine as one
 * Dictionary, so a label set twice takes its last value; an absent or invalid field is `{}`.
 *
 * @param message - A response, a request, or their headers.
 * @example combinePreferences(contentUsage(document, agent, url) ?? {}, getContentUsage(response))
 */
export function getContentUsage(message: Response | Request | Headers): Robots.UsagePreferences {
	let headers = message instanceof Headers ? message : message.headers;
	return readPreferences(headers.get(CONTENT_USAGE) ?? "");
}

/**
 * Sets the `Content-Usage` field, replacing any earlier value; preferences with no known
 * category delete it, since an empty field states nothing.
 *
 * @param headers - The headers to write.
 * @param preferences - `true` allows a category of use and `false` disallows it.
 * @example setContentUsage(response.headers, { search: true })
 */
export function setContentUsage(headers: Headers, preferences: Robots.UsagePreferences): void {
	let value = writePreferences(preferences);
	if (value === "") headers.delete(CONTENT_USAGE);
	else headers.set(CONTENT_USAGE, value);
}
