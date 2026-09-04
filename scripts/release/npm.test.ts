/**
 * The parser behind `npm view`: npm prints a bare string when one requested field exists, an
 * object when several do, an array when several versions match, and a JSON error object when
 * it fails, so every shape is covered here without spawning npm.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parsePublished } from "./npm.js";

describe("parsePublished", () => {
	test("reads a bare version string, which npm prints when gitHead is absent", () => {
		expect(unwrap(parsePublished('"2026.9.3"\n'))).toEqual({ version: "2026.9.3", gitHead: null });
	});

	test("reads version and gitHead from an object", () => {
		expect(unwrap(parsePublished('{"version":"2026.9.3","gitHead":"abc"}'))).toEqual({
			version: "2026.9.3",
			gitHead: "abc",
		});
	});

	test("takes the last entry when several versions match", () => {
		expect(
			unwrap(
				parsePublished('[{"version":"1.0.0","gitHead":"a"},{"version":"1.1.0","gitHead":"b"}]'),
			),
		).toEqual({ version: "1.1.0", gitHead: "b" });
		expect(unwrap(parsePublished('["1.0.0","1.1.0"]'))).toEqual({
			version: "1.1.0",
			gitHead: null,
		});
		expect(unwrap(parsePublished("[]"))).toBeNull();
	});

	test("treats E404 and empty output as never published", () => {
		expect(unwrap(parsePublished('{"error":{"code":"E404","summary":"Not Found"}}'))).toBeNull();
		expect(unwrap(parsePublished(""))).toBeNull();
	});

	test("fails any other npm error with its code and summary", () => {
		let unauthorized = parsePublished('{"error":{"code":"E401","summary":"Unauthorized"}}');
		let reset = parsePublished('{"error":{"code":"ECONNRESET","summary":"socket hang up"}}');

		expect(isFailure(unauthorized)).toBe(true);
		if (isFailure(unauthorized)) expect(unauthorized.error.message).toContain("E401");
		expect(isFailure(reset)).toBe(true);
		if (isFailure(reset)) expect(reset.error.message).toContain("socket hang up");
	});

	test("rejects output it cannot read as a version", () => {
		let unknownShape = parsePublished('{"name":"x"}');
		let notJson = parsePublished("npm WARN something");

		expect(isFailure(unknownShape)).toBe(true);
		if (isFailure(unknownShape)) expect(unknownShape.error.message).toContain('{"name":"x"}');
		expect(isFailure(notJson)).toBe(true);
	});
});
