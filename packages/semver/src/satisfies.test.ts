/**
 * The eight comparisons, checked on the cases a version-gated decision actually
 * turns on: the boundaries `~` and `^` draw, the order SemVer 2.0.0 gives
 * prereleases, and what text that is not a version answers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { expect, test } from "vitest";

import type { SemVerComparison } from "./types.js";

import { satisfies } from "./satisfies.js";

/** Every comparison, so a case about parsing can be asserted across all of them. */
const COMPARISONS: SemVerComparison[] = ["=", "!=", "<", "<=", ">", ">=", "~", "^"];

test.each([
	["1.2.3", "=", "1.2.3", true],
	["1.2.3", "=", "1.2.4", false],
	["1.2.3", "!=", "1.2.4", true],
	["1.2.3", "!=", "1.2.3", false],
	["1.2.3", "<", "1.10.0", true],
	["1.10.0", "<", "1.9.0", false],
	["1.2.3", "<=", "1.2.3", true],
	["1.2.4", "<=", "1.2.3", false],
	["2.0.0", ">", "1.99.99", true],
	["1.2.3", ">", "1.2.3", false],
	["1.2.3", ">=", "1.2.3", true],
	["1.2.3", ">=", "1.2.4", false],
] as const)("%s %s %s is %s", (value, comparison, against, expected) => {
	expect(satisfies(value, comparison, against)).toBe(expected);
});

test.each([
	["1.4.2", "~", "1.4.2", true],
	["1.4.5", "~", "1.4.2", true],
	["1.4.1", "~", "1.4.2", false],
	["1.5.0", "~", "1.4.2", false],
	["2.4.5", "~", "1.4.2", false],
	["0.4.5", "~", "0.4.2", true],
] as const)(
	"%s %s %s is %s, because a tilde holds within one minor",
	(value, comparison, against, expected) => {
		expect(satisfies(value, comparison, against)).toBe(expected);
	},
);

test.each([
	["1.4.2", "^", "1.4.2", true],
	["1.9.0", "^", "1.4.2", true],
	["1.4.1", "^", "1.4.2", false],
	["2.0.0", "^", "1.4.2", false],
	["0.2.3", "^", "0.2.3", true],
	["0.2.9", "^", "0.2.3", true],
	["0.3.0", "^", "0.2.3", false],
	["1.0.0", "^", "0.2.3", false],
	["0.0.3", "^", "0.0.3", true],
	["0.0.4", "^", "0.0.3", false],
] as const)(
	"%s %s %s is %s, because a caret holds the left-most non-zero element",
	(value, comparison, against, expected) => {
		expect(satisfies(value, comparison, against)).toBe(expected);
	},
);

test.each([
	["1.0.0-alpha", "<", "1.0.0-alpha.1", true],
	["1.0.0-alpha.1", "<", "1.0.0-alpha.beta", true],
	["1.0.0-alpha.beta", "<", "1.0.0-beta", true],
	["1.0.0-beta", "<", "1.0.0-beta.2", true],
	["1.0.0-beta.2", "<", "1.0.0-beta.11", true],
	["1.0.0-beta.11", "<", "1.0.0-rc.1", true],
	["1.0.0-rc.1", "<", "1.0.0", true],
	["1.0.0", ">", "1.0.0-rc.1", true],
	["1.0.0-rc.1", "=", "1.0.0-rc.1", true],
	["1.0.0-rc.1", "=", "1.0.0-rc.2", false],
	["1.2.3-rc.1", "~", "1.2.3", false],
	["1.2.4-rc.1", "^", "1.2.3", true],
] as const)(
	"%s %s %s is %s, a prerelease taking part by precedence alone",
	(value, comparison, against, expected) => {
		expect(satisfies(value, comparison, against)).toBe(expected);
	},
);

test.each([
	["1.2.3+build.5", "=", "1.2.3", true],
	["1.2.3", "=", "1.2.3+other", true],
	["1.2.3+a", "<", "1.2.3+b", false],
	["1.2.3+a", ">", "1.2.3+b", false],
	["1.0.0-rc.1+build", "<", "1.0.0", true],
] as const)(
	"%s %s %s is %s, build metadata carrying no precedence",
	(value, comparison, against, expected) => {
		expect(satisfies(value, comparison, against)).toBe(expected);
	},
);

test.each([
	["v1.2.3", "=", "1.2.3", true],
	["1.2.3", "=", "v1.2.3", true],
	["v1.2.3", "^", "v1.0.0", true],
] as const)(
	"%s %s %s is %s, a leading v reading as the version it labels",
	(value, comparison, against, expected) => {
		expect(satisfies(value, comparison, against)).toBe(expected);
	},
);

test.each(["", "1.2", "latest", "01.2.3", "1.2.3.4", "1.2.x", "v", "1.2.3-", "nightly-1.2.3"])(
	"%j answers false for every comparison, on either side",
	(malformed) => {
		for (let comparison of COMPARISONS) {
			expect(satisfies(malformed, comparison, "1.2.3")).toBe(false);
			expect(satisfies("1.2.3", comparison, malformed)).toBe(false);
		}
	},
);
