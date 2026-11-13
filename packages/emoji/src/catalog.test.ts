/**
 * Smoke-checks the generated catalog shape so a broken generator commit fails
 * without re-downloading upstream sources in every test run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { EMOJI_CATEGORIES, emojis, shortcodes } from "./catalog.js";

import { isUnicodeEmoji } from "./index.js";

describe("catalog", () => {
	test("ships one Unicode entry per glyph with categories from the fixed list", () => {
		expect(emojis.length).toBeGreaterThan(1500);
		let allowed = new Set<string>(EMOJI_CATEGORIES);
		for (let entry of emojis) {
			expect(isUnicodeEmoji(entry)).toBe(true);
			expect(allowed.has(entry.category)).toBe(true);
			expect(entry.shortcodes.length).toBeGreaterThan(0);
		}
	});

	test("indexes common GitHub shortcodes", () => {
		expect(shortcodes.get("tada") && "emoji" in shortcodes.get("tada")!).toBe(true);
		expect(shortcodes.get("+1") && "emoji" in shortcodes.get("+1")!).toBe(true);
		expect(shortcodes.get("smile") && "emoji" in shortcodes.get("smile")!).toBe(true);
	});
});
