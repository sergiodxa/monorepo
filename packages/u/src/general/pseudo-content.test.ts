/**
 * Quoting is load-bearing: `content: ""` must reach the stylesheet verbatim,
 * since only a valid quoted value generates the pseudo-element.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { pseudoContent } from "./pseudo-content.js";

describe("pseudoContent", () => {
	test("sets an empty pseudo-element content", async () => {
		expect(await declarations(pseudoContent('""'))).toEqual(['content: ""']);
	});

	test("sets a quoted string content", async () => {
		expect(await declarations(pseudoContent('"→"'))).toEqual(['content: "→"']);
	});
});
