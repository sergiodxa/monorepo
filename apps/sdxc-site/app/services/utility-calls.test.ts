/**
 * Covers the calls a utility's page derives from its first documented example, so a page
 * offers a custom value only where a scale step exists for one to replace.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vite-plus/test";

import { readUtility } from "~/app/services/utilities";
import { customValue } from "~/app/services/utility-calls";

describe("customValue", () => {
	test("swaps the scale step for a raw length", async () => {
		let reference = await readUtility("p");
		if (reference === null) throw new Error("p is missing from the catalogue");

		expect(customValue(reference)).toBe('u.p("2.75rem")');
	});

	test("offers nothing for a call that passes no scale step", async () => {
		let reference = await readUtility("transformStyle");
		if (reference === null) throw new Error("transformStyle is missing from the catalogue");

		expect(customValue(reference)).toBeNull();
	});
});
