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
	test("is true, so a decorative icon is hidden from assistive technology by default", () => {
		expect(DEFAULT_ICON_ARIA_HIDDEN).toBe(true);
	});
});
