/**
 * The eight comparisons one version can be asked to stand in against another,
 * covering what a rollout rule or a compatibility check needs without the range
 * grammar and its parser.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";

import type { SemVer, SemVerComparison } from "./types.js";

import { parse } from "./parse.js";
import { precedence } from "./precedence.js";

/**
 * Answer whether `value` stands in the named relation to `against`. A prerelease
 * takes part by precedence alone, so `1.2.4-rc.1` satisfies `^ 1.2.3`. Either
 * side that is not a version answers `false`, matching nothing rather than failing.
 *
 * @param value - The version being tested, e.g. one read from a request.
 * @param comparison - Which relation must hold.
 * @param against - The version the rule was written against.
 *
 * @example
 * satisfies("1.4.0", "~", "1.4.2"); // false
 * @example
 * satisfies("1.9.0", "^", "1.4.2"); // true
 * @example
 * satisfies("nightly", ">", "1.0.0"); // false
 */
export function satisfies(value: string, comparison: SemVerComparison, against: string): boolean {
	let left = parse(value);
	let right = parse(against);

	if (isFailure(left) || isFailure(right)) return false;

	let order = precedence(left.data, right.data);

	switch (comparison) {
		case "=":
			return order === 0;
		case "!=":
			return order !== 0;
		case "<":
			return order < 0;
		case "<=":
			return order <= 0;
		case ">":
			return order > 0;
		case ">=":
			return order >= 0;
		case "~":
			return order >= 0 && sharesMinor(left.data, right.data);
		case "^":
			return order >= 0 && sharesLeadingElement(left.data, right.data);
	}
}

/** Holds when `left` sits in the same minor series `right` names, which is the width of a `~`. */
function sharesMinor(left: SemVer, right: SemVer): boolean {
	return left.major === right.major && left.minor === right.minor;
}

/**
 * Holds when `left` keeps the element `right` stakes its compatibility on — the
 * major, or for a `0.x` version the minor, or for a `0.0.x` version the patch —
 * which is what makes `^0.2.3` exclude `0.3.0`.
 */
function sharesLeadingElement(left: SemVer, right: SemVer): boolean {
	if (right.major !== 0) return left.major === right.major;
	if (right.minor !== 0) return left.major === 0 && left.minor === right.minor;

	return left.major === 0 && left.minor === 0 && left.patch === right.patch;
}
