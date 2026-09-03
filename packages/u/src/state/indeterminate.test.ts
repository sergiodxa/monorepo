/**
 * Unit tests for `indeterminate.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { bg } from "../color/bg.js";
import { declarations, serialize } from "../internal/serialize.js";

import { indeterminate } from "./indeterminate.js";

describe("indeterminate", () => {
	test("emits both the native and the ARIA selector in one block", async () => {
		expect(await serialize(indeterminate(bg("brand.solid")))).toContain(
			'&:indeterminate, &[aria-checked="mixed"] {',
		);
		expect(await declarations(indeterminate(bg("brand.solid")))).toEqual([
			"background-color: var(--ui-brand-bg-solid)",
		]);
	});
});
