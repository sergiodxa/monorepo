/**
 * Unit tests for {@link "./disabled-selector"}: every assertion checks the
 * shared constant's exact string value, with no DOM and no rendering
 * involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { DISABLED_SELECTOR } from "./disabled-selector";

describe("DISABLED_SELECTOR", () => {
	test("is the exact native-disabled-or-aria-disabled selector list", () => {
		expect(DISABLED_SELECTOR).toBe(':disabled, [aria-disabled="true"]');
	});

	test("includes the native :disabled pseudo-class", () => {
		expect(DISABLED_SELECTOR.split(", ")).toContain(":disabled");
	});

	test("includes the aria-disabled attribute selector", () => {
		expect(DISABLED_SELECTOR.split(", ")).toContain('[aria-disabled="true"]');
	});
});
