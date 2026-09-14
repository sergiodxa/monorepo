/**
 * Tests for the ordering: the precedence SemVer 2.0.0 defines, and the totality a
 * sort over registry-supplied strings depends on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { compare } from "./compare.js";

describe("compare", () => {
	test("orders the core elements numerically rather than as text", () => {
		expect(["1.10.0", "1.9.0", "1.2.3"].sort(compare)).toEqual(["1.2.3", "1.9.0", "1.10.0"]);
		expect(["2026.10.1", "2026.9.4", "2026.9.30"].sort(compare)).toEqual([
			"2026.9.4",
			"2026.9.30",
			"2026.10.1",
		]);
	});

	test("ranks a prerelease below the release it leads to", () => {
		expect(compare("1.0.0-rc.1", "1.0.0")).toBeLessThan(0);
		expect(compare("1.0.0", "1.0.0-rc.1")).toBeGreaterThan(0);
	});

	test("follows the example order SemVer 2.0.0 spells out for prereleases", () => {
		let shuffled = [
			"1.0.0-beta.11",
			"1.0.0",
			"1.0.0-alpha.1",
			"1.0.0-rc.1",
			"1.0.0-alpha",
			"1.0.0-beta.2",
			"1.0.0-beta",
			"1.0.0-alpha.beta",
		];

		expect(shuffled.sort(compare)).toEqual([
			"1.0.0-alpha",
			"1.0.0-alpha.1",
			"1.0.0-alpha.beta",
			"1.0.0-beta",
			"1.0.0-beta.2",
			"1.0.0-beta.11",
			"1.0.0-rc.1",
			"1.0.0",
		]);
	});

	test("ranks the bootstrap placeholder below every dated release", () => {
		expect(["2026.9.4", "0.0.0-pre.1", "2026.10.1"].sort(compare).at(-1)).toBe("2026.10.1");
		expect(["0.0.0-pre.10", "0.0.0-pre.9", "0.0.0-pre.2"].sort(compare).at(-1)).toBe(
			"0.0.0-pre.10",
		);
	});

	test("ignores build metadata and a leading v", () => {
		expect(compare("1.2.3+a", "1.2.3+b")).toBe(0);
		expect(compare("v1.2.3", "1.2.3")).toBe(0);
	});

	test("sorts text that is not a version below every version, tying with such text", () => {
		expect(compare("latest", "0.0.0")).toBeLessThan(0);
		expect(compare("0.0.0", "latest")).toBeGreaterThan(0);
		expect(compare("latest", "nightly")).toBe(0);
		expect(["1.0.0", "latest", "0.9.0", ""].sort(compare)).toEqual([
			"latest",
			"",
			"0.9.0",
			"1.0.0",
		]);
	});
});
