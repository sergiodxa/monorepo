/**
 * Total SemVer 2.0.0 ordering over version strings, so a list read from a
 * registry or a tag listing sorts in one call even when some entry in it turns
 * out to be something other than a version.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";

import { parse } from "./parse.js";
import { precedence } from "./precedence.js";

/**
 * Order two version strings by SemVer 2.0.0 precedence, ready to hand to
 * `Array.prototype.sort`. Text that is not a version ranks below every version
 * and ties with other such text, which keeps the ordering total.
 *
 * @returns A negative number when `a` comes first, zero when the two rank equally.
 *
 * @example
 * ["2026.10.1", "2026.9.4"].sort(compare); // ["2026.9.4", "2026.10.1"]
 * @example
 * compare("1.0.0-rc.1", "1.0.0"); // negative, a prerelease preceding its release
 * @example
 * ["1.0.0", "latest"].sort(compare); // ["latest", "1.0.0"]
 */
export function compare(a: string, b: string): number {
	let left = parse(a);
	let right = parse(b);

	if (isFailure(left)) return isFailure(right) ? 0 : -1;
	if (isFailure(right)) return 1;

	return precedence(left.data, right.data);
}
