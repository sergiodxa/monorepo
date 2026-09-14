/**
 * SemVer 2.0.0 precedence over already-parsed versions, shared by the string
 * ordering and by the comparison set so both answer from one definition of which
 * version comes first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SemVer } from "./types.js";

/** A whole numeric identifier, which sorts by value where a textual one sorts by character. */
const NUMERIC = /^\d+$/;

/**
 * Order two parsed versions: the core elements first, then the prerelease, with a
 * prerelease ranking below the release it leads to.
 *
 * @returns A negative number when `left` comes first, zero when the two rank equally.
 */
export function precedence(left: SemVer, right: SemVer): number {
	if (left.major !== right.major) return left.major - right.major;
	if (left.minor !== right.minor) return left.minor - right.minor;
	if (left.patch !== right.patch) return left.patch - right.patch;

	if (left.prerelease.length === 0 && right.prerelease.length === 0) return 0;
	if (left.prerelease.length === 0) return 1;
	if (right.prerelease.length === 0) return -1;

	return comparePrerelease(left.prerelease, right.prerelease);
}

/**
 * Compare prerelease identifiers pairwise: numerically where both are numeric, by
 * character otherwise, with a numeric identifier ranking below a textual one. A
 * list that runs out first ranks below the one that continues.
 */
function comparePrerelease(left: string[], right: string[]): number {
	for (let index = 0; index < Math.max(left.length, right.length); index++) {
		let one = left[index];
		let other = right[index];

		if (one === undefined) return -1;
		if (other === undefined) return 1;
		if (one === other) continue;

		if (NUMERIC.test(one) && NUMERIC.test(other)) return Number(one) - Number(other);
		if (NUMERIC.test(one)) return -1;
		if (NUMERIC.test(other)) return 1;

		return one < other ? -1 : 1;
	}

	return 0;
}
