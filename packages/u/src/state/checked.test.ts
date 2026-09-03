/**
 * Unit tests for `checked.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { bg } from "../color/bg.js";
import { declarations, serialize } from "../internal/serialize.js";

import { checked } from "./checked.js";

describe("checked", () => {
	test("emits both the native and the ARIA selector in one block", async () => {
		expect(await serialize(checked(bg("brand.solid")))).toContain(
			'&:checked, &[aria-checked="true"] {',
		);
		expect(await declarations(checked(bg("brand.solid")))).toEqual([
			"background-color: var(--ui-brand-bg-solid)",
		]);
	});
});
