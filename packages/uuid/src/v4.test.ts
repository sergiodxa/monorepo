/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { generateUUID } from "./v4.js";

import { isUUID } from "./index.js";

describe(generateUUID.name, () => {
	test("returns a valid UUID", () => {
		expect(isUUID(generateUUID())).toBe(true);
	});

	test("carries version 4 and the RFC 9562 variant", () => {
		let id = generateUUID();

		expect(id[14]).toBe("4");
		expect(["8", "9", "a", "b"]).toContain(id[19]);
	});

	test("returns a different value on every call", () => {
		expect(generateUUID()).not.toBe(generateUUID());
	});
});
