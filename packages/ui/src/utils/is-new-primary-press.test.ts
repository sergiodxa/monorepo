/**
 * Unit tests for the pointerdown guard in {@link "./is-new-primary-press"}:
 * every assertion passes a plain `{ isPrimary, button }` pair alongside a
 * tracked pointer id.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { isNewPrimaryPress } from "./is-new-primary-press.js";

describe(isNewPrimaryPress.name, () => {
	test("reports true for a primary pointer, primary button, with no pointer already tracked", () => {
		expect(isNewPrimaryPress({ isPrimary: true, button: 0 }, undefined)).toBe(true);
	});

	test("reports false while another pointer is already tracked", () => {
		expect(isNewPrimaryPress({ isPrimary: true, button: 0 }, 7)).toBe(false);
	});

	test("reports false for a non-primary pointer", () => {
		expect(isNewPrimaryPress({ isPrimary: false, button: 0 }, undefined)).toBe(false);
	});

	test("reports false for a secondary or auxiliary button", () => {
		expect(isNewPrimaryPress({ isPrimary: true, button: 1 }, undefined)).toBe(false);
		expect(isNewPrimaryPress({ isPrimary: true, button: 2 }, undefined)).toBe(false);
	});

	test("reports false when every condition fails at once", () => {
		expect(isNewPrimaryPress({ isPrimary: false, button: 2 }, 7)).toBe(false);
	});
});
