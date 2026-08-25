/**
 * Unit test for the decorative-icon default in
 * {@link "./decorative-icon"}: confirms the constant a consumer would spread
 * onto `aria-hidden` holds the value that hides a purely visual glyph from
 * assistive technology.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { DEFAULT_ICON_ARIA_HIDDEN } from "./decorative-icon";

describe("DEFAULT_ICON_ARIA_HIDDEN", () => {
	/**
	 * `aria-hidden` takes a token, and a `true` boolean prop renders as the
	 * bare attribute name `aria-hidden=""`, which announces the icon instead
	 * of hiding it — asserting the type here guards against that regression.
	 */
	test('is the string "true", so a decorative icon is really hidden and not just marked', () => {
		expect(DEFAULT_ICON_ARIA_HIDDEN).toBe("true");
		expect(typeof DEFAULT_ICON_ARIA_HIDDEN).toBe("string");
	});
});
