/**
 * Checks demo display expansion turns known shortcodes into Unicode glyphs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { expandEmoji } from "./expand-emoji.js";

describe("expandEmoji", () => {
	test("expands shortcodes used in demo composers", () => {
		expect(expandEmoji("Fixed :bug: in login")).toBe("Fixed 🐛 in login");
		expect(expandEmoji("Ship it :tada:")).toBe("Ship it 🎉");
	});
});
