/**
 * The parser behind `npm view`: npm prints a bare string when one requested field exists, an
 * object when several do, an array when several versions match, and a JSON error object when
 * it fails, so every shape is covered here without spawning npm.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { parsePublished } from "./npm.js";

describe("parsePublished", () => {
	test("reads a bare version string, which npm prints when gitHead is absent", () => {
		expect(parsePublished('"2026.9.3"\n')).toEqual({ version: "2026.9.3", gitHead: null });
	});

	test("reads version and gitHead from an object", () => {
		expect(parsePublished('{"version":"2026.9.3","gitHead":"abc"}')).toEqual({
			version: "2026.9.3",
			gitHead: "abc",
		});
	});

	test("takes the last entry when several versions match", () => {
		expect(
			parsePublished('[{"version":"1.0.0","gitHead":"a"},{"version":"1.1.0","gitHead":"b"}]'),
		).toEqual({ version: "1.1.0", gitHead: "b" });
		expect(parsePublished('["1.0.0","1.1.0"]')).toEqual({ version: "1.1.0", gitHead: null });
		expect(parsePublished("[]")).toBeNull();
	});

	test("treats E404 and empty output as never published", () => {
		expect(parsePublished('{"error":{"code":"E404","summary":"Not Found"}}')).toBeNull();
		expect(parsePublished("")).toBeNull();
	});

	test("throws any other npm error with its code and summary", () => {
		expect(() => parsePublished('{"error":{"code":"E401","summary":"Unauthorized"}}')).toThrow(
			"E401",
		);
		expect(() =>
			parsePublished('{"error":{"code":"ECONNRESET","summary":"socket hang up"}}'),
		).toThrow("socket hang up");
	});

	test("rejects output it cannot read as a version", () => {
		expect(() => parsePublished('{"name":"x"}')).toThrow();
	});
});
