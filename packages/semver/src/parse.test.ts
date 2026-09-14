/**
 * Tests for the grammar gate: which text SemVer 2.0.0 admits, what the elements
 * come back as, and that everything else is a failure naming the rejected text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { InvalidSemVerError } from "./invalid-semver-error.js";
import { parse } from "./parse.js";

describe("parse", () => {
	test("reads the core elements as numbers", () => {
		expect(unwrap(parse("1.2.3"))).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] });
		expect(unwrap(parse("0.0.0"))).toEqual({ major: 0, minor: 0, patch: 0, prerelease: [] });
		expect(unwrap(parse("10.20.30"))).toEqual({
			major: 10,
			minor: 20,
			patch: 30,
			prerelease: [],
		});
	});

	test("accepts the v a git tag or a user agent carries in front", () => {
		expect(unwrap(parse("v1.2.3"))).toEqual(unwrap(parse("1.2.3")));
	});

	test("splits the prerelease into its dot-separated identifiers", () => {
		expect(unwrap(parse("1.0.0-rc.1")).prerelease).toEqual(["rc", "1"]);
		expect(unwrap(parse("1.0.0-alpha")).prerelease).toEqual(["alpha"]);
		expect(unwrap(parse("1.0.0-0.3.7-x")).prerelease).toEqual(["0", "3", "7-x"]);
	});

	test("drops build metadata, which carries no precedence", () => {
		expect(unwrap(parse("1.2.3+build.5"))).toEqual(unwrap(parse("1.2.3")));
		expect(unwrap(parse("1.0.0-rc.1+build"))).toEqual(unwrap(parse("1.0.0-rc.1")));
	});

	test.each(["", "1.2", "latest", "01.2.3", "1.2.3.4", "1.2.x", "v", "1.2.3-", "nightly-1.2.3"])(
		"rejects %j, naming it on the error",
		(text) => {
			let result = parse(text);

			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error).toBeInstanceOf(InvalidSemVerError);
				expect(result.error.text).toBe(text);
				expect(result.error.message).toBe(`Invalid version: ${JSON.stringify(text)}`);
			}
		},
	);
});
