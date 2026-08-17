/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { anchorName } from "./anchor-name";

describe("anchorName", () => {
	test("prefixes the name with --", async () => {
		expect(await declarations(anchorName("tooltip-trigger"))).toEqual([
			"anchor-name: --tooltip-trigger",
		]);
	});

	test("prefixes a single-word name the same way", async () => {
		expect(await declarations(anchorName("trigger"))).toEqual(["anchor-name: --trigger"]);
	});
});
