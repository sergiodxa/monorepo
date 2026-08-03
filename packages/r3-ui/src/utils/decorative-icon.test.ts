/**
 * Unit test for the decorative-icon default in
 * {@link "./decorative-icon"}: confirms the constant a consumer would spread
 * onto `aria-hidden` holds the value that hides a purely visual glyph from
 * assistive technology.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { DEFAULT_ICON_ARIA_HIDDEN } from "./decorative-icon";

describe("DEFAULT_ICON_ARIA_HIDDEN", () => {
	/**
	 * The string, not the boolean. `aria-hidden` takes a token, and the renderer
	 * writes a `true` prop the way HTML wants a boolean attribute written — as the
	 * bare name — leaving `aria-hidden=""`, which is not that token, so the glyph
	 * would be announced instead of hidden. This asserts the type as well as the
	 * value, because the boolean is the spelling that looks tidier and silently
	 * does nothing.
	 */
	test('is the string "true", so a decorative icon is really hidden and not just marked', () => {
		expect(DEFAULT_ICON_ARIA_HIDDEN).toBe("true");
		expect(typeof DEFAULT_ICON_ARIA_HIDDEN).toBe("string");
	});
});
