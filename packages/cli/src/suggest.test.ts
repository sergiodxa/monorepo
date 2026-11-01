/**
 * Tests the closest-name suggestion behind every "did you mean" hint: a typo, a swapped pair
 * and a dropped character each suggest the intended name, and an unrelated word suggests
 * nothing, so a hint only appears when it is likely right.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { closest } from "./index.js";

describe("closest", () => {
	test("suggests the name a substitution, a swap or a dropped character came from", () => {
		let names = ["uuid", "jsonpath", "json-patch", "install"];

		expect(closest("uiid", names)).toBe("uuid");
		expect(closest("jsonpaht", names)).toBe("jsonpath");
		expect(closest("instal", names)).toBe("install");
	});

	test("prefers the nearer of two candidates", () => {
		expect(closest("jsonpat", ["json-patch", "jsonpath"])).toBe("jsonpath");
	});

	test("suggests nothing for an unrelated or empty list", () => {
		expect(closest("zzz", ["uuid", "jwt"])).toBeUndefined();
		expect(closest("uuid", [])).toBeUndefined();
	});
});
