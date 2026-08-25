/**
 * Exercises the declaration cloning helper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { cloneDeclaration } from "./clone-declaration";

describe("cloneDeclaration", () => {
	test("returns undefined for missing declarations", () => {
		expect(cloneDeclaration()).toBeUndefined();
	});

	test("returns a cloned declaration object", () => {
		let original = {
			version: "1.0",
			encoding: "UTF-8",
			standalone: "yes" as const,
		};

		let cloned = cloneDeclaration(original);

		expect(cloned).toEqual(original);
		expect(cloned).not.toBe(original);
	});
});
